from flask import Blueprint, request, jsonify, send_file
import pandas as pd
from datetime import datetime, timedelta
from pymongo import MongoClient, DESCENDING
from bson.objectid import ObjectId
import os
from dotenv import load_dotenv
import oracledb
from pathlib import Path
from io import BytesIO
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib import colors
from collections import Counter
from ..models.sankhya_model import db as sankhya_db, ProgramacaoItem

# Garante que o .env na raiz do projeto seja carregado,
# independentemente de onde o script é executado.
env_path = Path(__file__).resolve().parents[2] / '.env'
load_dotenv(dotenv_path=env_path)

# MongoDB Connection
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
mongo_db = client.planejamento_db
programacao_results_collection = mongo_db.programacao_results
atrasos_historico_collection = mongo_db.atrasos_historico
motivos_ocorrencia_collection = mongo_db.motivos_ocorrencia

# Sankhya DB Connection Details
SANKHYA_USER = os.getenv("SANKHYA_USER")
SANKHYA_PASSWORD = os.getenv("SANKHYA_PASSWORD")
SANKHYA_DSN = os.getenv("SANKHYA_DSN")

gantt_bp = Blueprint("gantt", __name__, url_prefix="/api/gantt")

@gantt_bp.route("/analise_gantt_moldes", methods=["POST"])
def analise_gantt_moldes():
    """
    Gera dados para o gráfico de Gantt de ocupação de moldes
    """
    try:
        data = request.get_json()
        programacao_id = data.get("programacao_id")
        
        if not programacao_id:
            return jsonify({"error": "ID da programação é obrigatório"}), 400
        
        # Buscar dados da programação no MongoDB
        programacao = programacao_results_collection.find_one({"_id": ObjectId(programacao_id)})
        if not programacao:
            return jsonify({"error": "Programação não encontrada"}), 404
        
        programacao_data = programacao.get("programacao_data", [])
        if not programacao_data:
            return jsonify({"error": "Dados de programação não encontrados"}), 404
        
        # Processar dados para Gantt de moldes
        gantt_data = []
        molde_ocupacao = {}
        
        for item in programacao_data:
            molde_key = f"{item['Produto']} - Braço {item['Braço']}"
            data_prevista = item["Data Prevista"]
            rodada = item["Número da Rodada"]
            
            if molde_key not in molde_ocupacao:
                molde_ocupacao[molde_key] = {
                    "datas": [],
                    "rodadas": [],
                    "quantidade_total": 0
                }
            
            molde_ocupacao[molde_key]["datas"].append(data_prevista)
            molde_ocupacao[molde_key]["rodadas"].append(rodada)
            molde_ocupacao[molde_key]["quantidade_total"] += item["Quantidade Programada"]
        
        # Converter para formato Gantt
        for molde, info in molde_ocupacao.items():
            datas_unicas = sorted(list(set(info["datas"])))
            if datas_unicas:
                # Converter datas do formato DD/MM/YYYY para datetime
                data_inicio = datetime.strptime(datas_unicas[0], "%d/%m/%Y")
                data_fim = datetime.strptime(datas_unicas[-1], "%d/%m/%Y")
                
                gantt_data.append({
                    "id": f"molde_{len(gantt_data)}",
                    "name": molde,
                    "start": data_inicio.strftime("%Y-%m-%d"),
                    "end": (data_fim + timedelta(days=1)).strftime("%Y-%m-%d"),
                    "progress": 100,
                    "custom_class": "gantt-molde",
                    "quantidade": info["quantidade_total"]
                })
        
        return jsonify({
            "gantt_data": gantt_data,
            "total_moldes": len(gantt_data)
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Erro ao gerar análise Gantt de moldes: {str(e)}"}), 500

@gantt_bp.route("/analise_gantt_pedidos", methods=["POST"])
def analise_gantt_pedidos():
    """
    Gera dados para o gráfico de Gantt de conclusão de pedidos
    """
    try:
        data = request.get_json()
        programacao_id = data.get("programacao_id")
        
        if not programacao_id:
            return jsonify({"error": "ID da programação é obrigatório"}), 400
        
        # Buscar dados da programação no MongoDB
        programacao = programacao_results_collection.find_one({"_id": ObjectId(programacao_id)})
        if not programacao:
            return jsonify({"error": "Programação não encontrada"}), 404
        
        programacao_data = programacao.get("programacao_data", [])
        if not programacao_data:
            return jsonify({"error": "Dados de programação não encontrados"}), 404
        
        # Processar dados para Gantt de pedidos
        gantt_data = []
        pedido_progresso = {}
        
        for item in programacao_data:
            pedido = item["Pedido"]
            data_prevista = item["Data Prevista"]
            quantidade = item["Quantidade Programada"]
            
            if pedido not in pedido_progresso:
                pedido_progresso[pedido] = {
                    "datas": [],
                    "quantidade_total": 0,
                    "produto": item["Produto"]
                }
            
            pedido_progresso[pedido]["datas"].append(data_prevista)
            pedido_progresso[pedido]["quantidade_total"] += quantidade
        
        # Converter para formato Gantt
        for pedido, info in pedido_progresso.items():
            datas_unicas = sorted(list(set(info["datas"])))
            if datas_unicas:
                # Converter datas do formato DD/MM/YYYY para datetime
                data_inicio = datetime.strptime(datas_unicas[0], "%d/%m/%Y")
                data_fim = datetime.strptime(datas_unicas[-1], "%d/%m/%Y")
                
                pedido_int = int(pedido)

                # Determinar cor baseada no tipo de pedido
                cor_classe = "gantt-pedido-normal"
                if str(pedido_int) in ["9999997", "9999998", "9999999"]:
                    cor_classe = "gantt-pedido-estoque"
                
                gantt_data.append({
                    "id": f"pedido_{pedido_int}",
                    "name": f"Pedido {pedido_int} - {info['produto']}",
                    "start": data_inicio.strftime("%Y-%m-%d"),
                    "end": (data_fim + timedelta(days=1)).strftime("%Y-%m-%d"),
                    "progress": 100,
                    "custom_class": cor_classe,
                    "quantidade": info["quantidade_total"],
                    "tipo": "estoque" if str(pedido_int) in ["9999997", "9999998", "9999999"] else "pedido"
                })
        
        return jsonify({
            "gantt_data": gantt_data,
            "total_pedidos": len(gantt_data)
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Erro ao gerar análise Gantt de pedidos: {str(e)}"}), 500

@gantt_bp.route("/comparar_programacoes", methods=["POST"])
def comparar_programacoes():
    """
    Compara datas finais de pedidos entre duas programações
    """
    try:
        data = request.get_json()
        programacao_id_1 = data.get("programacao_id_1")
        programacao_id_2 = data.get("programacao_id_2")
        
        if not programacao_id_1 or not programacao_id_2:
            return jsonify({"error": "IDs das duas programações são obrigatórios"}), 400
        
        # Buscar ambas as programações
        prog1 = programacao_results_collection.find_one({"_id": ObjectId(programacao_id_1)})
        prog2 = programacao_results_collection.find_one({"_id": ObjectId(programacao_id_2)})
        
        if not prog1 or not prog2:
            return jsonify({"error": "Uma ou ambas as programações não foram encontradas"}), 404
        
        # Calcular datas de conclusão para cada programação
        conclusoes_prog1 = calcular_datas_conclusao(prog1.get("programacao_data", []))
        conclusoes_prog2 = calcular_datas_conclusao(prog2.get("programacao_data", []))
        
        # Comparar as datas
        comparacao = []
        pedidos_comuns = set(conclusoes_prog1.keys()) & set(conclusoes_prog2.keys())
        
        for pedido in pedidos_comuns:
            data1 = datetime.strptime(conclusoes_prog1[pedido]["data_conclusao"], "%d/%m/%Y")
            data2 = datetime.strptime(conclusoes_prog2[pedido]["data_conclusao"], "%d/%m/%Y")
            
            diferenca_dias = (data2 - data1).days
            
            comparacao.append({
                "pedido": int(pedido),
                "produto": conclusoes_prog1[pedido]["produto"],
                "data_prog1": conclusoes_prog1[pedido]["data_conclusao"],
                "data_prog2": conclusoes_prog2[pedido]["data_conclusao"],
                "diferenca_dias": diferenca_dias,
                "status": "adiantou" if diferenca_dias < 0 else "atrasou" if diferenca_dias > 0 else "igual"
            })
        
        # Estatísticas da comparação
        total_pedidos = len(comparacao)
        adiantaram = len([c for c in comparacao if c["diferenca_dias"] < 0])
        atrasaram = len([c for c in comparacao if c["diferenca_dias"] > 0])
        iguais = len([c for c in comparacao if c["diferenca_dias"] == 0])
        
        return jsonify({
            "comparacao": sorted(comparacao, key=lambda x: abs(x["diferenca_dias"]), reverse=True),
            "estatisticas": {
                "total_pedidos": total_pedidos,
                "adiantaram": adiantaram,
                "atrasaram": atrasaram,
                "iguais": iguais,
                "maior_atraso": max([c["diferenca_dias"] for c in comparacao]) if comparacao else 0,
                "maior_adiantamento": min([c["diferenca_dias"] for c in comparacao]) if comparacao else 0
            },
            "info_programacoes": {
                "prog1": {
                    "timestamp": prog1.get("timestamp"),
                    "braco_selecionado": prog1.get("braco_selecionado"),
                    "descricao": prog1.get("descricao"),
                    "tipo": prog1.get("tipo")
                },
                "prog2": {
                    "timestamp": prog2.get("timestamp"),
                    "braco_selecionado": prog2.get("braco_selecionado"),
                    "descricao": prog2.get("descricao"),
                    "tipo": prog2.get("tipo")
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Erro ao comparar programações: {str(e)}"}), 500

def calcular_datas_conclusao(programacao_data):
    """
    Calcula as datas de início e conclusão de cada pedido baseado na programação
    """
    pedido_info = {}
    
    for item in programacao_data:
        pedido = item["Pedido"]
        data_prevista = item["Data Prevista"]
        quantidade = item["Quantidade Programada"]
        
        if pedido not in pedido_info:
            pedido_info[pedido] = {
                "datas": [],
                "quantidade_total": 0,
                "produto": item["Produto"]
            }
        
        pedido_info[pedido]["datas"].append(data_prevista)
        pedido_info[pedido]["quantidade_total"] += quantidade
    
    # Determinar data de início e conclusão
    conclusoes = {}
    for pedido, info in pedido_info.items():
        if not info["datas"]:
            continue
        datas_ordenadas = sorted(info["datas"], key=lambda x: datetime.strptime(x, "%d/%m/%Y"))
        conclusoes[pedido] = {
            "data_inicio": datas_ordenadas[0],
            "data_conclusao": datas_ordenadas[-1],
            "produto": info["produto"],
            "quantidade_total": info["quantidade_total"]
        }
    
    return conclusoes

def get_valor_pedido(nunota):
    """
    Busca o valor da nota (VLRNOTA) no banco de dados Sankhya.
    Retorna 0.0 se não encontrar ou em caso de erro.
    """
    if not all([SANKHYA_USER, SANKHYA_PASSWORD, SANKHYA_DSN]):
        print(f"Variáveis de ambiente Sankhya não configuradas. Retornando valor 0 para NUNOTA {nunota}.")
        return 0.0

    valor_nota = 0.0
    try:
        # O NUNOTA pode vir como string ou float (ex: "12345.0")
        nunota_int = int(float(nunota))
        with oracledb.connect(user=SANKHYA_USER, password=SANKHYA_PASSWORD, dsn=SANKHYA_DSN) as connection:
            with connection.cursor() as cursor:
                sql = "SELECT VLRNOTA FROM TGFCAB WHERE NUNOTA = :nunota"
                cursor.execute(sql, nunota=nunota_int)
                result = cursor.fetchone()
                if result and result[0] is not None:
                    valor_nota = float(result[0])
    except oracledb.Error as e:
        print(f"Erro de banco de dados Oracle ao buscar valor para NUNOTA {nunota}: {e}")
        valor_nota = 0.0
    except Exception as e:
        print(f"Erro geral ao buscar valor para NUNOTA {nunota}: {e}")
        valor_nota = 0.0
    return valor_nota

def get_razao_social(nunota):
    """
    Busca a razão social do cliente no banco de dados Sankhya.
    """
    if not all([SANKHYA_USER, SANKHYA_PASSWORD, SANKHYA_DSN]):
        print("Variáveis de ambiente Sankhya não configuradas. Retornando cliente padrão.")
        return "Cliente (configurar .env)"

    razao_social = "Cliente não encontrado"
    try:
        with oracledb.connect(user=SANKHYA_USER, password=SANKHYA_PASSWORD, dsn=SANKHYA_DSN) as connection:
            with connection.cursor() as cursor:
                sql = """
                    SELECT PAR.RAZAOSOCIAL 
                    FROM TGFPAR PAR 
                    JOIN TGFCAB CAB ON CAB.CODPARC = PAR.CODPARC 
                    WHERE CAB.NUNOTA = :nunota
                """
                cursor.execute(sql, nunota=nunota)
                result = cursor.fetchone()
                if result:
                    razao_social = result[0]
    except Exception as e:
        error_message = f"Erro ao conectar ao DB Sankhya para NUNOTA {nunota}: {e}"
        print(error_message)
        razao_social = "Erro de conexão DB"
    return razao_social

def build_pdf_report(programacao_data, historico_atrasos):
    """
    Constrói um relatório detalhado em PDF a partir dos dados de uma programação.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=18)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='Center', alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='Right', alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='Left', alignment=TA_LEFT))
    styles.add(ParagraphStyle(name='TableHeader', fontSize=8, fontName='Helvetica-Bold', alignment=TA_CENTER, textColor=colors.whitesmoke))
    styles.add(ParagraphStyle(name='TableCell', fontSize=7, fontName='Helvetica'))
    
    elements = []
    
    # Título
    title = "Relatório de Planejamento de Produção"
    elements.append(Paragraph(title, styles['h1']))
    
    timestamp = programacao_data.get('timestamp').strftime('%d/%m/%Y %H:%M:%S')
    elements.append(Paragraph(f"Programação de: {timestamp}", styles['Normal']))
    elements.append(Spacer(1, 20))

    # --- Resumo / KPIs ---
    elements.append(Paragraph("Resumo do Planejamento", styles['h2']))
    
    prog_data = programacao_data.get("programacao_data", [])
    ociosos_data = programacao_data.get("moldes_ociosos_data", [])
    
    # Filtra para não mostrar produtos com 0 moldes cadastrados
    sem_molde_data_raw = programacao_data.get("necessidade_sem_moldes_data", [])
    sem_molde_data = [item for item in sem_molde_data_raw if item.get("Qtd. Moldes Cadastrados", 0) > 0]

    stock_order_ids = ["9999997", "9999998", "9999999"]

    total_pedidos = len(set(p['Pedido'] for p in prog_data)) if prog_data else 0
    itens_pedidos = sum(p['Quantidade Programada'] for p in prog_data if str(int(p['Pedido'])) not in stock_order_ids) if prog_data else 0
    itens_estoque = sum(p['Quantidade Programada'] for p in prog_data if str(int(p['Pedido'])) in stock_order_ids) if prog_data else 0
    moldes_ociosos = len(ociosos_data) if ociosos_data else 0
    produtos_sem_molde = len(sem_molde_data) if sem_molde_data else 0

    kpi_data = [
        [Paragraph('<b>Total de Pedidos</b>', styles['Left']), Paragraph(f"{total_pedidos:,}".replace(",", "."), styles['Right'])],
        [Paragraph('<b>Itens para Pedidos</b>', styles['Left']), Paragraph(f"{itens_pedidos:,}".replace(",", "."), styles['Right'])],
        [Paragraph('<b>Itens para Estoque</b>', styles['Left']), Paragraph(f"{itens_estoque:,}".replace(",", "."), styles['Right'])],
        [Paragraph('<b>Moldes Ociosos</b>', styles['Left']), Paragraph(f"{moldes_ociosos:,}".replace(",", "."), styles['Right'])],
        [Paragraph('<b>Produtos Sem Molde</b>', styles['Left']), Paragraph(f"{produtos_sem_molde:,}".replace(",", "."), styles['Right'])],
    ]
    kpi_table = Table(kpi_data, colWidths=[200, 100])
    kpi_table.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 1, colors.black), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 20))

    # --- Histórico de Atrasos ---
    if historico_atrasos:
        elements.append(Paragraph("Histórico de Atrasos de Pedidos", styles['h2']))
        
        # Filtra para mostrar apenas a análise mais recente de cada pedido atrasado, evitando duplicatas
        historico_atrasos.sort(key=lambda x: x.get('timestamp_analise'), reverse=True)
        pedidos_vistos = set()
        historico_filtrado = []
        for item in historico_atrasos:
            pedido = item.get('pedido')
            if pedido not in pedidos_vistos:
                historico_filtrado.append(item)
                pedidos_vistos.add(pedido)

        # Ordena por dias de atraso (decrescente)
        historico_filtrado.sort(key=lambda x: x.get('dias_atraso', 0), reverse=True)

        atrasos_table_data = [
            [Paragraph(h, styles['TableHeader']) for h in ['Data Análise', 'Pedido', 'Cliente', 'Dias Atraso', 'Motivo']]
        ]
        for item in historico_filtrado:
            data_analise = item.get('timestamp_analise').strftime('%d/%m/%Y %H:%M') if item.get('timestamp_analise') else 'N/A'
            row = [
                data_analise,
                item.get('pedido', ''),
                item.get('cliente', ''),
                item.get('dias_atraso', ''),
                item.get('motivo_atraso', 'Não atribuído')
            ]
            atrasos_table_data.append([Paragraph(str(cell), styles['TableCell']) for cell in row])
        
        atrasos_table = Table(atrasos_table_data, colWidths=[70, 60, 180, 60, 182])
        atrasos_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkred),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightpink)
        ]))
        elements.append(atrasos_table)
        elements.append(Spacer(1, 20))

    # --- Pontos de Atenção ---
    if ociosos_data or sem_molde_data:
        elements.append(PageBreak())
        elements.append(Paragraph("Pontos de Atenção", styles['h2']))

    if ociosos_data:
        elements.append(Paragraph("Moldes Ociosos", styles['h3']))
        ociosos_table_data = [[Paragraph(h, styles['TableHeader']) for h in ['Nome', 'Quantidade', 'Rodada Ociosa', 'Braço']]]
        for item in ociosos_data:
            row = [item.get('Nome', ''), item.get('Quantidade', ''), item.get('Rodada Ociosa', ''), item.get('Braço', '')]
            ociosos_table_data.append([Paragraph(str(cell), styles['TableCell']) for cell in row])
        
        ociosos_table = Table(ociosos_table_data, colWidths=[250, 100, 100, 100])
        ociosos_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.orange),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightyellow)
        ]))
        elements.append(ociosos_table)
        elements.append(Spacer(1, 20))

    if sem_molde_data:
        elements.append(Paragraph("Necessidade Sem Moldes", styles['h3']))
        # Ordena por quantidade faltante (decrescente)
        
        # Agrupar por produto e somar quantidades
        necessidade_agrupada = {}
        for item in sem_molde_data:
            produto_nome = item.get('Produto', item.get('Nome', ''))
            if produto_nome not in necessidade_agrupada:
                necessidade_agrupada[produto_nome] = {
                    "Quantidade": 0,
                    "Qtd. Moldes Cadastrados": item.get('Qtd. Moldes Cadastrados', 0)
                }
            necessidade_agrupada[produto_nome]["Quantidade"] += item.get('Quantidade', 0)

        # Converter para lista e ordenar
        lista_agrupada = [{"Produto": k, **v} for k, v in necessidade_agrupada.items()]
        lista_agrupada.sort(key=lambda x: x.get('Quantidade', 0), reverse=True)

        sem_molde_table_data = [[Paragraph(h, styles['TableHeader']) for h in ['Produto', 'Qtd. Faltante', 'Qtd. Cadastrada']]]
        for item in lista_agrupada:
            row = [item.get('Produto', ''), item.get('Quantidade', ''), item.get('Qtd. Moldes Cadastrados', '')]
            sem_molde_table_data.append([Paragraph(str(cell), styles['TableCell']) for cell in row])
        
        sem_molde_table = Table(sem_molde_table_data, colWidths=[312, 120, 120])
        sem_molde_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.red),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, 1), (-1, -1), colors.pink)
        ]))
        elements.append(sem_molde_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer

@gantt_bp.route("/alertas_inteligentes", methods=["POST"])
def gerar_alertas_inteligentes():
    """
    Gera alertas inteligentes baseados na análise da programação
    """
    try:
        data = request.get_json()
        programacao_id = data.get("programacao_id")
        
        if not programacao_id:
            return jsonify({"error": "ID da programação é obrigatório"}), 400
        
        # Buscar dados da programação
        programacao = programacao_results_collection.find_one({"_id": ObjectId(programacao_id)})
        if not programacao:
            return jsonify({"error": "Programação não encontrada"}), 404
        
        alertas = []
        
        # Analisar dados da programação
        programacao_data = programacao.get("programacao_data", [])
        moldes_ociosos_data = programacao.get("moldes_ociosos_data", [])
        
        necessidade_sem_moldes_data_raw = programacao.get("necessidade_sem_moldes_data", [])
        necessidade_sem_moldes_data = [item for item in necessidade_sem_moldes_data_raw if item.get("Qtd. Moldes Cadastrados", 0) > 0]

        # Alerta 1: Pedidos prioritários com atraso
        pedidos_prioritarios = [item for item in programacao_data 
                              if str(int(item["Pedido"])) not in ["9999997", "9999998", "9999999"]]
        
        if pedidos_prioritarios:
            # Verificar se há pedidos com datas muito distantes
            datas_futuras = []
            for item in pedidos_prioritarios:
                data_prevista = datetime.strptime(item["Data Prevista"], "%d/%m/%Y")
                dias_diferenca = (data_prevista - datetime.now()).days
                if dias_diferenca > 7:  # Mais de 7 dias
                    datas_futuras.append(dias_diferenca)
            
            if datas_futuras:
                media_dias = sum(datas_futuras) / len(datas_futuras)
                alertas.append({
                    "tipo": "critico",
                    "titulo": "Pedidos Prioritários com Atraso",
                    "mensagem": f"{len(datas_futuras)} pedidos prioritários têm previsão de conclusão em média {media_dias:.1f} dias.",
                    "icone": "fa-exclamation-triangle"
                })
        
        # Alerta 2: Concentração de demanda não atendida
        if necessidade_sem_moldes_data:
            produtos_sem_molde = {}
            for item in necessidade_sem_moldes_data:
                produto = item["Nome"]
                quantidade = item["Quantidade"]
                if produto not in produtos_sem_molde:
                    produtos_sem_molde[produto] = 0
                produtos_sem_molde[produto] += quantidade
            
            # Encontrar o produto com maior demanda não atendida
            produto_critico = max(produtos_sem_molde.items(), key=lambda x: x[1])
            total_nao_atendido = sum(produtos_sem_molde.values())
            percentual = (produto_critico[1] / total_nao_atendido) * 100
            
            if percentual > 50:
                alertas.append({
                    "tipo": "atencao",
                    "titulo": "Concentração de Demanda Não Atendida",
                    "mensagem": f"{percentual:.1f}% da demanda não atendida está concentrada no produto {produto_critico[0]}.",
                    "icone": "fa-exclamation-circle"
                })
        
        # Alerta 3: Oportunidade de otimização - moldes ociosos
        if moldes_ociosos_data:
            moldes_por_braco = {}
            for item in moldes_ociosos_data:
                braco = item["Braço"]
                if braco not in moldes_por_braco:
                    moldes_por_braco[braco] = 0
                moldes_por_braco[braco] += item["Quantidade"]
            
            # Verificar se algum braço tem mais de 50% dos moldes ociosos
            for braco, qtd_ociosos in moldes_por_braco.items():
                # Calcular total de moldes do braço (seria necessário dados adicionais)
                # Por enquanto, assumindo que mais de 10 moldes ociosos é significativo
                if qtd_ociosos > 10:
                    alertas.append({
                        "tipo": "oportunidade",
                        "titulo": "Oportunidade de Otimização",
                        "mensagem": f"O Braço {braco} tem {qtd_ociosos} moldes ociosos durante todo o período de planejamento.",
                        "icone": "fa-lightbulb"
                    })
        
        # Alerta 4: Balanceamento de carga
        if programacao_data:
            producao_por_braco = {}
            for item in programacao_data:
                braco = item["Braço"]
                if braco not in producao_por_braco:
                    producao_por_braco[braco] = 0
                producao_por_braco[braco] += item["Quantidade Programada"]
            
            if len(producao_por_braco) > 1:
                valores = list(producao_por_braco.values())
                media = sum(valores) / len(valores)
                desvio = max(valores) - min(valores)
                
                if desvio > media * 0.5:  # Desvio maior que 50% da média
                    braco_sobrecarregado = max(producao_por_braco.items(), key=lambda x: x[1])
                    braco_subutilizado = min(producao_por_braco.items(), key=lambda x: x[1])
                    
                    alertas.append({
                        "tipo": "info",
                        "titulo": "Desbalanceamento de Carga",
                        "mensagem": f"Braço {braco_sobrecarregado[0]} está sobrecarregado ({braco_sobrecarregado[1]} unidades) enquanto Braço {braco_subutilizado[0]} está subutilizado ({braco_subutilizado[1]} unidades).",
                        "icone": "fa-balance-scale"
                    })
        
        return jsonify({
            "alertas": alertas,
            "total_alertas": len(alertas),
            "timestamp": datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Erro ao gerar alertas inteligentes: {str(e)}"}), 500

@gantt_bp.route("/gantt_comparacao_atrasos", methods=["GET"])
def gantt_comparacao_atrasos():
    """
    Gera dados para um gráfico de Gantt comparando os atrasos
    entre as duas últimas programações.
    """
    try:
        # 1. Buscar as duas últimas programações
        cursor = programacao_results_collection.find().sort("timestamp", DESCENDING).limit(2)
        programacoes = list(cursor)
        
        if len(programacoes) < 2:
            return jsonify({
                "gantt_data": [], 
                "message": "Pelo menos duas programações são necessárias para comparação."
            }), 200
        
        prog_recente, prog_anterior = programacoes[0], programacoes[1]

        # 2. Calcular datas de conclusão para cada programação
        conclusoes_recente = calcular_datas_conclusao(prog_recente.get("programacao_data", []))
        conclusoes_anterior = calcular_datas_conclusao(prog_anterior.get("programacao_data", []))

        # 3. Comparar as datas e encontrar atrasos
        comparacao = []
        pedidos_comuns = set(conclusoes_recente.keys()) & set(conclusoes_anterior.keys())

        # Define os pedidos de estoque a serem excluídos da análise de atraso
        stock_order_ids = ["9999997", "9999998", "9999999"]

        # Filtra os pedidos comuns para remover os de estoque
        # Converte para int para remover casas decimais (ex: 9999997.0 -> 9999997) antes de comparar
        pedidos_filtrados = [p for p in pedidos_comuns if str(int(p)) not in stock_order_ids]
        
        for pedido in pedidos_filtrados:
            data_fim_anterior = datetime.strptime(conclusoes_anterior[pedido]["data_conclusao"], "%d/%m/%Y")
            data_fim_recente = datetime.strptime(conclusoes_recente[pedido]["data_conclusao"], "%d/%m/%Y")
            
            diferenca_dias = (data_fim_recente - data_fim_anterior).days
            
            if diferenca_dias > 0: # Apenas atrasos
                comparacao.append({
                    "pedido": pedido,
                    "produto": conclusoes_recente[pedido]["produto"],
                    "diferenca_dias": diferenca_dias,
                    "anterior": conclusoes_anterior[pedido],
                    "recente": conclusoes_recente[pedido]
                })
        
        # 4. Ordenar por maior atraso e pegar o top 5
        comparacao.sort(key=lambda x: x["diferenca_dias"], reverse=True)
        top_atrasos = comparacao[:5]

        # 5. Formatar para o gráfico de Gantt e Tabela de Detalhes
        gantt_data = []
        table_data = []
        prog_recente_data = prog_recente.get("programacao_data", [])

        for item in top_atrasos:
            pedido_int = int(item['pedido'])
            
            start_anterior = datetime.strptime(item["anterior"]["data_inicio"], "%d/%m/%Y")
            end_anterior = datetime.strptime(item["anterior"]["data_conclusao"], "%d/%m/%Y")
            gantt_data.append({
                "id": f"comp_{pedido_int}_anterior", "name": f"Pedido {pedido_int} (Anterior)",
                "start": start_anterior.strftime("%Y-%m-%d"), "end": (end_anterior + timedelta(days=1)).strftime("%Y-%m-%d"),
                "progress": 100, "custom_class": "bar-comparison-old"
            })

            start_recente = datetime.strptime(item["recente"]["data_inicio"], "%d/%m/%Y")
            end_recente = datetime.strptime(item["recente"]["data_conclusao"], "%d/%m/%Y")
            gantt_data.append({
                "id": f"comp_{pedido_int}_recente", "name": f"Pedido {pedido_int} (Recente)",
                "start": start_recente.strftime("%Y-%m-%d"), "end": (end_recente + timedelta(days=1)).strftime("%Y-%m-%d"),
                "progress": 100, "custom_class": "bar-comparison-new"
            })

            # Identificar os itens específicos que causaram o atraso
            data_fim_anterior_dt = datetime.strptime(item["anterior"]["data_conclusao"], "%d/%m/%Y")
            itens_do_pedido_recente = [
                i for i in prog_recente_data if int(i.get("Pedido", 0)) == pedido_int
            ]
            
            itens_causadores = []
            for i in itens_do_pedido_recente:
                data_item_recente_dt = datetime.strptime(i["Data Prevista"], "%d/%m/%Y")
                if data_item_recente_dt > data_fim_anterior_dt:
                    dias_atraso_item = (data_item_recente_dt - data_fim_anterior_dt).days
                    if dias_atraso_item > 0:
                        itens_causadores.append({
                            "produto": i.get("Produto"),
                            "codprod": i.get("CODPROD"),
                            "cor": i.get("Cor"),
                            "data_prevista": i.get("Data Prevista"),
                            "dias_atraso_item": dias_atraso_item
                        })
            
            # Ordenar por maior impacto
            itens_causadores.sort(key=lambda x: x['dias_atraso_item'], reverse=True)

            # Buscar nome do cliente e adicionar dados para a tabela
            nome_cliente = get_razao_social(pedido_int)
            table_data.append({
                "pedido": pedido_int,
                "cliente": nome_cliente,
                "dias_atraso": item["diferenca_dias"],
                "itens_causadores": itens_causadores
            })

        # Salvar histórico de atrasos no banco
        if table_data:
            atrasos_para_salvar = []
            timestamp_analise = datetime.now()
            prog_recente_id = prog_recente.get("_id")
            prog_anterior_id = prog_anterior.get("_id")

            for item in table_data:
                atrasos_para_salvar.append({
                    "timestamp_analise": timestamp_analise,
                    "pedido": item["pedido"],
                    "cliente": item["cliente"],
                    "dias_atraso": item["dias_atraso"],
                    "itens_causadores": item.get("itens_causadores", []),
                    "programacao_recente_id": prog_recente_id,
                    "programacao_anterior_id": prog_anterior_id
                })
            
            if atrasos_para_salvar:
                atrasos_historico_collection.insert_many(atrasos_para_salvar)

        return jsonify({"gantt_data": gantt_data, "table_data": table_data}), 200

    except Exception as e:
        return jsonify({"error": f"Erro ao gerar Gantt de comparação de atrasos: {str(e)}"}), 500

@gantt_bp.route("/excluir_planejamento/<programacao_id>", methods=["DELETE"])
def excluir_planejamento(programacao_id):
    """
    Exclui um planejamento específico pelo seu ID.
    """
    try:
        if not ObjectId.is_valid(programacao_id):
            return jsonify({"error": "ID de programação inválido"}), 400

        result = programacao_results_collection.delete_one({"_id": ObjectId(programacao_id)})
        
        if result.deleted_count == 1:
            return jsonify({"message": "Planejamento excluído com sucesso"}), 200
        else:
            return jsonify({"error": "Planejamento não encontrado para exclusão"}), 404
            
    except Exception as e:
        return jsonify({"error": f"Erro ao excluir planejamento: {str(e)}"}), 500

@gantt_bp.route("/historico_atrasos", methods=["GET"])
def get_historico_atrasos():
    """
    Retorna o histórico de atrasos salvos.
    """
    try:
        # Limita aos 100 registros mais recentes para não sobrecarregar
        historico = list(atrasos_historico_collection.find().sort("timestamp_analise", DESCENDING).limit(100))
        
        # Converter ObjectId e datetime para string para JSON
        for item in historico:
            item["_id"] = str(item["_id"])
            if "programacao_recente_id" in item and item["programacao_recente_id"]:
                item["programacao_recente_id"] = str(item["programacao_recente_id"])
            if "programacao_anterior_id" in item and item["programacao_anterior_id"]:
                item["programacao_anterior_id"] = str(item["programacao_anterior_id"])

        return jsonify({"historico_atrasos": historico}), 200
        
    except Exception as e:
        return jsonify({"error": f"Erro ao obter histórico de atrasos: {str(e)}"}), 500

@gantt_bp.route("/motivos/listar", methods=["GET"])
def listar_motivos():
    """
    Lista todos os motivos de ocorrência cadastrados.
    """
    try:
        motivos = list(motivos_ocorrencia_collection.find().sort("motivo", 1))
        for motivo in motivos:
            motivo["_id"] = str(motivo["_id"])
        return jsonify({"motivos": motivos}), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao listar motivos: {str(e)}"}), 500

@gantt_bp.route("/motivos/adicionar", methods=["POST"])
def adicionar_motivo():
    """
    Adiciona um novo motivo de ocorrência.
    """
    try:
        data = request.get_json()
        novo_motivo = data.get("motivo")
        if not novo_motivo:
            return jsonify({"error": "O texto do motivo é obrigatório"}), 400
        
        if motivos_ocorrencia_collection.find_one({"motivo": novo_motivo}):
            return jsonify({"error": "Este motivo já existe"}), 409

        result = motivos_ocorrencia_collection.insert_one({
            "motivo": novo_motivo,
            "timestamp": datetime.now()
        })
        
        return jsonify({"message": "Motivo adicionado com sucesso", "id": str(result.inserted_id)}), 201
    except Exception as e:
        return jsonify({"error": f"Erro ao adicionar motivo: {str(e)}"}), 500

@gantt_bp.route("/motivos/excluir/<motivo_id>", methods=["DELETE"])
def excluir_motivo(motivo_id):
    """
    Exclui um motivo de ocorrência pelo seu ID.
    """
    try:
        if not ObjectId.is_valid(motivo_id):
            return jsonify({"error": "ID de motivo inválido"}), 400

        result = motivos_ocorrencia_collection.delete_one({"_id": ObjectId(motivo_id)})
        
        if result.deleted_count == 1:
            return jsonify({"message": "Motivo excluído com sucesso"}), 200
        else:
            return jsonify({"error": "Motivo não encontrado"}), 404
    except Exception as e:
        return jsonify({"error": f"Erro ao excluir motivo: {str(e)}"}), 500

@gantt_bp.route("/atrasos/atribuir_motivo/<atraso_id>", methods=["PUT"])
def atribuir_motivo_atraso(atraso_id):
    try:
        data = request.get_json()
        motivo = data.get("motivo")
        if not ObjectId.is_valid(atraso_id) or not motivo:
            return jsonify({"error": "Dados inválidos"}), 400

        result = atrasos_historico_collection.update_one(
            {"_id": ObjectId(atraso_id)},
            {"$set": {"motivo_atraso": motivo, "motivo_atribuido_em": datetime.now()}}
        )
        if result.matched_count == 1:
            return jsonify({"message": "Motivo atribuído com sucesso"}), 200
        else:
            return jsonify({"error": "Registro de atraso não encontrado"}), 404
    except Exception as e:
        return jsonify({"error": f"Erro ao atribuir motivo: {str(e)}"}), 500

@gantt_bp.route("/consultar_pedido/<int:pedido_id>", methods=["GET"])
def consultar_pedido(pedido_id):
    """
    Consulta os detalhes de um pedido específico no último planejamento.
    """
    try:
        # 1. Buscar o último planejamento
        ultimo_planejamento = programacao_results_collection.find_one(
            sort=[("timestamp", DESCENDING)]
        )
        if not ultimo_planejamento:
            return jsonify({"error": "Nenhum planejamento encontrado"}), 404

        programacao_data = ultimo_planejamento.get("programacao_data", [])
        if not programacao_data:
            return jsonify({"error": "Dados de programação não encontrados no último planejamento"}), 404

        # 2. Filtrar itens do pedido
        # O campo 'Pedido' pode ser float, então convertemos para int para comparar
        itens_do_pedido = [
            item for item in programacao_data if int(item.get("Pedido", 0)) == pedido_id
        ]

        if not itens_do_pedido:
            return jsonify({"error": f"Pedido {pedido_id} não encontrado no último planejamento"}), 404

        # 3. Calcular data de finalização e coletar detalhes
        datas_previstas = []
        detalhes_itens = []

        for item in itens_do_pedido:
            datas_previstas.append(datetime.strptime(item["Data Prevista"], "%d/%m/%Y"))
            detalhes_itens.append({
                "produto": item.get("Produto"),
                "braco": item.get("Braço"),
                "rodada": item.get("Número da Rodada"),
                "data_prevista_item": item.get("Data Prevista"),
                "quantidade": item.get("Quantidade Programada")
            })
        
        data_finalizacao = max(datas_previstas).strftime("%d/%m/%Y")

        # Ordenar os itens por data e rodada para melhor visualização
        detalhes_itens.sort(key=lambda x: (datetime.strptime(x['data_prevista_item'], "%d/%m/%Y"), x['rodada']))

        return jsonify({
            "pedido_id": pedido_id,
            "data_finalizacao": data_finalizacao,
            "itens": detalhes_itens,
            "timestamp_planejamento": ultimo_planejamento.get("timestamp")
        }), 200

    except Exception as e:
        return jsonify({"error": f"Erro ao consultar pedido: {str(e)}"}), 500

@gantt_bp.route("/gerar_relatorio_pdf/<programacao_id>", methods=["POST"])
def gerar_relatorio_pdf(programacao_id):
    """
    Gera um relatório detalhado em PDF para uma programação específica.
    """
    try:
        if not ObjectId.is_valid(programacao_id):
            return jsonify({"error": "ID de programação inválido"}), 400

        programacao = programacao_results_collection.find_one({"_id": ObjectId(programacao_id)})
        if not programacao:
            return jsonify({"error": "Programação não encontrada"}), 404

        # Buscar histórico de atrasos onde esta programação foi a mais recente
        historico_atrasos = list(atrasos_historico_collection.find(
            {"programacao_recente_id": ObjectId(programacao_id)}
        ).sort("timestamp_analise", DESCENDING))

        pdf_buffer = build_pdf_report(programacao, historico_atrasos)
        
        return send_file(
            pdf_buffer,
            as_attachment=True,
            download_name=f"relatorio_programacao_{programacao_id}.pdf",
            mimetype='application/pdf'
        )
    except Exception as e:
        return jsonify({"error": f"Erro ao gerar relatório PDF: {str(e)}"}), 500

@gantt_bp.route("/projecao_finalizacao_pedidos", methods=["POST"])
def projecao_finalizacao_pedidos():
    """
    Gera dados para os gráficos de projeção de finalização de pedidos (quantidade, valor e detalhes).
    """
    try:
        data = request.get_json()
        programacao_id = data.get("programacao_id")

        if not programacao_id:
            return jsonify({"error": "ID da programação é obrigatório"}), 400

        programacao = programacao_results_collection.find_one({"_id": ObjectId(programacao_id)})
        if not programacao:
            return jsonify({"error": "Programação não encontrada"}), 404

        programacao_data = programacao.get("programacao_data", [])
        if not programacao_data:
            return jsonify({"labels": [], "data_quantidade": [], "data_valor": [], "detalhes_por_dia": {}}), 200

        conclusoes_pedidos = calcular_datas_conclusao(programacao_data)

        contagem_por_dia = Counter()
        valor_por_dia = Counter()
        detalhes_por_dia = {}
        stock_order_ids = ["9999997", "9999998", "9999999"]

        # Calcula a quantidade de itens planejados por dia (nova lógica)
        itens_planejados_por_dia = Counter()
        for item in programacao_data:
            try:
                data_prevista_dt = datetime.strptime(item["Data Prevista"], "%d/%m/%Y")
                itens_planejados_por_dia[data_prevista_dt] += item.get("Quantidade Programada", 0)
            except (ValueError, TypeError, KeyError) as e:
                print(f"Aviso: Ignorando item para projeção de itens planejados devido a dados inválidos: {e}")
                continue

        # Calcula métricas de finalização de pedidos (lógica existente)
        for pedido, info in conclusoes_pedidos.items():
            try:
                data_conclusao_dt = datetime.strptime(info["data_conclusao"], "%d/%m/%Y")
                data_conclusao_str = data_conclusao_dt.strftime("%d/%m/%Y")

                contagem_por_dia[data_conclusao_dt] += 1
                
                valor_pedido = 0.0
                cliente = "Estoque"
                pedido_int_str = str(int(float(pedido)))

                if pedido_int_str not in stock_order_ids:
                    valor_pedido = get_valor_pedido(pedido)
                    cliente = get_razao_social(int(float(pedido)))
                
                valor_por_dia[data_conclusao_dt] += valor_pedido

                # Adiciona detalhes para o dia
                if data_conclusao_str not in detalhes_por_dia:
                    detalhes_por_dia[data_conclusao_str] = []
                
                detalhes_por_dia[data_conclusao_str].append({
                    "pedido": pedido_int_str,
                    "cliente": cliente,
                    "produto": info["produto"],
                    "valor": valor_pedido
                })
            except (ValueError, TypeError) as e:
                print(f"Aviso: Ignorando pedido '{pedido}' devido a dados inválidos: {e}")
                continue

        # Unifica as datas de todos os contadores
        todas_as_datas = set(contagem_por_dia.keys()) | set(itens_planejados_por_dia.keys())

        if not todas_as_datas:
            return jsonify({"labels": [], "data_quantidade": [], "data_valor": [], "data_itens": [], "detalhes_por_dia": {}}), 200

        datas_ordenadas = sorted(list(todas_as_datas))
        
        labels = [d.strftime("%d/%m/%Y") for d in datas_ordenadas]
        data_points_quantidade = [contagem_por_dia.get(d, 0) for d in datas_ordenadas]
        data_points_valor = [valor_por_dia.get(d, 0.0) for d in datas_ordenadas]
        data_points_itens = [itens_planejados_por_dia.get(d, 0) for d in datas_ordenadas]

        return jsonify({
            "labels": labels, 
            "data_quantidade": data_points_quantidade,
            "data_valor": data_points_valor,
            "data_itens": data_points_itens,
            "detalhes_por_dia": detalhes_por_dia
        }), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao gerar projeção de finalização: {str(e)}"}), 500

@gantt_bp.route("/enviar_para_sankhya", methods=["POST"])
def enviar_para_sankhya():
    """
    Recebe os dados da programação e os insere na tabela AD_PLAN do Sankhya.
    """
    try:
        data = request.get_json()
        programacao_data = data.get("programacao_data")

        if not programacao_data:
            return jsonify({"error": "Nenhum dado de programação recebido."}), 400

        # Obter o próximo NUPLAN (PK)
        # A forma mais segura é usar uma sequence do Oracle, mas aqui vamos usar MAX+1
        max_nuplan_result = sankhya_db.session.query(sankhya_db.func.max(ProgramacaoItem.nuplan)).scalar()
        nuplan_counter = (max_nuplan_result or 0) + 1

        # Preparar os novos registros
        novos_itens = []
        for item_data in programacao_data:
            # Usa o método de classe do modelo para criar a instância
            novo_item = ProgramacaoItem.from_programacao_data(item_data, nuplan_counter)
            novos_itens.append(novo_item)
            nuplan_counter += 1
        
        # Inserir em lote (bulk) para melhor performance
        if novos_itens:
            sankhya_db.session.bulk_save_objects(novos_itens)
            sankhya_db.session.commit()

        return jsonify({
            "message": f"{len(novos_itens)} registros de programação foram enviados com sucesso para o Sankhya.",
            "registros_inseridos": len(novos_itens)
        }), 200

    except Exception as e:
        # Em caso de erro, desfaz a transação
        sankhya_db.session.rollback()
        print(f"Erro ao enviar para o Sankhya: {e}")
        # Retorna um erro genérico para o frontend para não expor detalhes do banco
        return jsonify({"error": f"Ocorreu um erro no servidor ao enviar os dados para o Sankhya."}), 500

@gantt_bp.route("/listar_simulacoes", methods=["GET"])
def listar_simulacoes():
    """
    Lista todos os planejamentos salvos que são do tipo 'Simulação de Setup'.
    """
    try:
        # Busca por documentos que tenham o campo 'tipo' igual a 'Simulação de Setup'
        # e ordena pelos mais recentes primeiro.
        cursor = programacao_results_collection.find( # Exclui o campo 'programacao_data' para um carregamento mais rápido
            {"tipo": "Simulação de Setup"}
        , {"programacao_data": 0}).sort("timestamp", DESCENDING)
        
        simulacoes = list(cursor)
        
        # Converte ObjectId para string para ser serializável em JSON
        for sim in simulacoes:
            sim["_id"] = str(sim["_id"])

        return jsonify({"simulacoes": simulacoes}), 200
        
    except Exception as e:
        return jsonify({"error": f"Erro ao listar simulações: {str(e)}"}), 500

@gantt_bp.route("/salvar_planejamento_alternativo", methods=["POST"])
def salvar_planejamento_alternativo():
    """
    Salva um novo documento de planejamento no MongoDB,
    geralmente vindo de uma simulação do sandbox.
    """
    try:
        planejamento_data = request.get_json()

        if not planejamento_data or "programacao_data" not in planejamento_data:
            return jsonify({"error": "Dados de planejamento inválidos ou ausentes."}), 400

        # Adiciona/atualiza o timestamp para garantir que é o mais recente
        planejamento_data["timestamp"] = datetime.now()

        # Remove o campo _id se ele existir, pois o MongoDB irá gerar um novo
        if "_id" in planejamento_data:
            del planejamento_data["_id"]

        # Insere o novo documento de planejamento na coleção
        result = programacao_results_collection.insert_one(planejamento_data)

        return jsonify({
            "message": "Simulação salva com sucesso como um novo planejamento!",
            "id_salvo": str(result.inserted_id)
        }), 201

    except Exception as e:
        return jsonify({"error": f"Erro ao salvar planejamento alternativo: {str(e)}"}), 500

@gantt_bp.route("/obter_ultimo_planejamento", methods=["GET"])
def obter_ultimo_planejamento():
    """
    Retorna o resultado do último planejamento executado.
    """
    try:
        # Busca o último documento ordenando por timestamp descendente
        ultimo_planejamento = programacao_results_collection.find_one(
            sort=[("timestamp", DESCENDING)]
        )
        
        if ultimo_planejamento:
            # Converter ObjectId para string para ser serializável em JSON
            if "_id" in ultimo_planejamento:
                 ultimo_planejamento["_id"] = str(ultimo_planejamento["_id"])

            return jsonify({"ultimo_planejamento": ultimo_planejamento}), 200
        else:
            return jsonify({"error": "Nenhum planejamento encontrado"}), 404
            
    except Exception as e:
        return jsonify({"error": f"Erro ao obter último planejamento: {str(e)}"}), 500

@gantt_bp.route("/obter_planejamento/<programacao_id>", methods=["GET"])
def obter_planejamento_por_id(programacao_id):
    """
    Retorna o resultado de um planejamento específico pelo seu ID.
    """
    try:
        if not ObjectId.is_valid(programacao_id):
            return jsonify({"error": "ID de programação inválido"}), 400

        planejamento = programacao_results_collection.find_one({"_id": ObjectId(programacao_id)})
        
        if planejamento:
            planejamento["_id"] = str(planejamento["_id"])
            return jsonify(planejamento), 200
        else:
            return jsonify({"error": "Planejamento não encontrado"}), 404
            
    except Exception as e:
        return jsonify({"error": f"Erro ao obter planejamento: {str(e)}"}), 500

@gantt_bp.route("/detalhes_pedido/<int:pedido_id>", methods=["GET"])
def get_detalhes_pedido(pedido_id):
    """
    Busca detalhes adicionais de um pedido, como cliente e valor.
    """
    try:
        razao_social = get_razao_social(pedido_id)
        valor_pedido = get_valor_pedido(pedido_id)
        
        return jsonify({
            "pedido": pedido_id,
            "cliente": razao_social,
            "valor": valor_pedido
        }), 200

    except Exception as e:
        return jsonify({"error": f"Erro ao buscar detalhes do pedido {pedido_id}: {str(e)}"}), 500
