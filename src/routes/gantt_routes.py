from flask import Blueprint, request, jsonify
import pandas as pd
from datetime import datetime, timedelta
from pymongo import MongoClient, DESCENDING
from bson.objectid import ObjectId
import os
from dotenv import load_dotenv
import oracledb
from pathlib import Path

# Garante que o .env na raiz do projeto seja carregado,
# independentemente de onde o script é executado.
env_path = Path(__file__).resolve().parents[2] / '.env'
load_dotenv(dotenv_path=env_path)

# MongoDB Connection
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client.planejamento_db
programacao_results_collection = db.programacao_results

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
                    "braco_selecionado": prog1.get("braco_selecionado")
                },
                "prog2": {
                    "timestamp": prog2.get("timestamp"),
                    "braco_selecionado": prog2.get("braco_selecionado")
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
        necessidade_sem_moldes_data = programacao.get("necessidade_sem_moldes_data", [])
        
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

            # Buscar nome do cliente e adicionar dados para a tabela
            nome_cliente = get_razao_social(pedido_int)
            table_data.append({
                "pedido": pedido_int,
                "cliente": nome_cliente,
                "dias_atraso": item["diferenca_dias"]
            })

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
