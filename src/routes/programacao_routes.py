from flask import Blueprint, request, jsonify, send_file
import pandas as pd
import os
from datetime import datetime, timedelta
import math
import pickle
import json
from pymongo import MongoClient, DESCENDING
from dotenv import load_dotenv
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB Atlas Connection
MONGO_URI = os.getenv("MONGO_URI")
logger.info("Conectando ao MongoDB Atlas...")
try:
    client = MongoClient(MONGO_URI)
    db = client.planejamento_db # Using a new database name for planning
    programacao_results_collection = db.programacao_results
    logger.info("Conexão com MongoDB Atlas estabelecida com sucesso.")
except Exception as e:
    logger.error(f"Erro ao conectar com MongoDB: {e}")
    client = None
    db = None
    programacao_results_collection = None

# Index creation
def create_indexes():
    try:
        programacao_results_collection.create_index([("timestamp", DESCENDING)])
        logger.info("Index on 'timestamp' created successfully.")
    except Exception as e:
        logger.error(f"Error creating index: {e}")

def load_last_program_result():
    return None

# Define o blueprint para as rotas de programação
programacao_bp = Blueprint("programacao", __name__, url_prefix="/api/programacao")

# Variáveis globais para armazenar os dataframes carregados
setup_df = None
faltas_df = None
cadastro_moldes_df = None
CACHE_FILE_CADASTRO = "cadastro_moldes_cache.pkl"

# Função para salvar cache
def salvar_cache(dados, arquivo):
    with open(arquivo, "wb") as f:
        pickle.dump(dados, f)

# Função para carregar cache
def carregar_cache(arquivo):
    if os.path.exists(arquivo):
        with open(arquivo, "rb") as f:
            return pickle.load(f)
    return None

def calcular_data_futura(data_inicio, dias_de_trabalho, incluir_sabado, incluir_domingo):
    """
    Calcula uma data futura, contando apenas os dias úteis definidos.
    `dias_de_trabalho` é o número do dia de trabalho (ex: 1 para o primeiro dia, 2 para o segundo).
    """
    if dias_de_trabalho <= 0:
        dias_de_trabalho = 1 # Garante que sempre calcule pelo menos o primeiro dia

    data_atual = data_inicio
    dias_trabalhados_contados = 0
    
    # Loop para encontrar o início do primeiro dia de trabalho, caso a data de início seja um fds não trabalhado
    while True:
        dia_da_semana = data_atual.weekday() # Monday is 0, Sunday is 6
        is_sabado = (dia_da_semana == 5)
        is_domingo = (dia_da_semana == 6)
        if (is_sabado and not incluir_sabado) or (is_domingo and not incluir_domingo):
            data_atual += timedelta(days=1)
            continue
        break # Encontrou um dia de trabalho

    dias_trabalhados_contados = 1

    # Loop para contar os dias de trabalho restantes
    while dias_trabalhados_contados < dias_de_trabalho:
        data_atual += timedelta(days=1)
        dia_da_semana = data_atual.weekday()
        is_sabado = (dia_da_semana == 5)
        is_domingo = (dia_da_semana == 6)
        
        if (is_sabado and not incluir_sabado) or (is_domingo and not incluir_domingo):
            continue # Pula o dia, mas não incrementa o contador
        
        dias_trabalhados_contados += 1
        
    return data_atual

@programacao_bp.route("/upload_setup", methods=["POST"])
def upload_setup():
    logger.info("Rota /upload_setup chamada.")
    global setup_df
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Nome de arquivo vazio"}), 400
    if file and file.filename.endswith(".xlsx"):
        try:
            logger.info(f"Carregando planilha de Setup: {file.filename}")
            setup_df = pd.read_excel(file)
            if 'CODGRUPOPROD' in setup_df.columns:
                logger.info("Convertendo 'CODGRUPOPROD' em setup_df para inteiro para consistência.")
                setup_df['CODGRUPOPROD'] = pd.to_numeric(setup_df['CODGRUPOPROD'], errors='coerce').fillna(0).astype(int)
            if 'QTDMOL' in setup_df.columns:
                logger.info("Convertendo 'QTDMOL' em setup_df para numérico para consistência.")
                setup_df['QTDMOL'] = pd.to_numeric(setup_df['QTDMOL'], errors='coerce').fillna(0).astype(int)
            logger.info(f"Planilha de Setup '{file.filename}' carregada com sucesso. Dimensões: {setup_df.shape}")
            return jsonify({"message": "Planilha de Setup carregada com sucesso!"}), 200
        except Exception as e:
            logger.exception(f"Erro ao carregar planilha de Setup '{file.filename}'.")
            return jsonify({"error": f"Erro ao carregar planilha de Setup: {e}"}), 500
    logger.error(f"Formato de arquivo inválido para /upload_setup: {file.filename}. Use .xlsx")
    return jsonify({"error": "Formato de arquivo inválido. Use .xlsx"}), 400

@programacao_bp.route("/upload_faltas", methods=["POST"])
def upload_faltas():
    logger.info("Rota /upload_faltas chamada.")
    global faltas_df
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Nome de arquivo vazio"}), 400
    if file and file.filename.endswith(".xlsx"):
        try:
            logger.info(f"Carregando planilha de Faltas: {file.filename}")
            faltas_df = pd.read_excel(file)
            if 'CODGRUPOPROD' in faltas_df.columns:
                logger.info("Convertendo 'CODGRUPOPROD' em faltas_df para inteiro para consistência.")
                faltas_df['CODGRUPOPROD'] = pd.to_numeric(faltas_df['CODGRUPOPROD'], errors='coerce').fillna(0).astype(int)
            logger.info(f"Planilha de Faltas '{file.filename}' carregada com sucesso. Dimensões: {faltas_df.shape}")
            return jsonify({"message": "Planilha de Faltas carregada com sucesso!"}), 200
        except Exception as e:
            logger.exception(f"Erro ao carregar planilha de Faltas '{file.filename}'.")
            return jsonify({"error": f"Erro ao carregar planilha de Faltas: {e}"}), 500
    logger.error(f"Formato de arquivo inválido para /upload_faltas: {file.filename}. Use .xlsx")
    return jsonify({"error": "Formato de arquivo inválido. Use .xlsx"}), 400

@programacao_bp.route("/upload_cadastro_moldes", methods=["POST"])
def upload_cadastro_moldes():
    logger.info("Rota /upload_cadastro_moldes chamada.")
    global cadastro_moldes_df
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Nome de arquivo vazio"}), 400
    if file and file.filename.endswith(".xlsx"):
        try:
            logger.info(f"Carregando Cadastro de Moldes: {file.filename}")
            cadastro_moldes_df = pd.read_excel(file)
            logger.info(f"Cadastro de Moldes '{file.filename}' carregado com sucesso. Dimensões: {cadastro_moldes_df.shape}")
            salvar_cache(cadastro_moldes_df, CACHE_FILE_CADASTRO)
            logger.info(f"Cache do Cadastro de Moldes salvo em '{CACHE_FILE_CADASTRO}'.")
            return jsonify({"message": "Cadastro de Moldes carregado com sucesso!"}), 200
        except Exception as e:
            logger.exception(f"Erro ao carregar Cadastro de Moldes '{file.filename}'.")
            return jsonify({"error": f"Erro ao carregar cadastro de moldes: {e}"}), 500
    logger.error(f"Formato de arquivo inválido para /upload_cadastro_moldes: {file.filename}. Use .xlsx")
    return jsonify({"error": "Formato de arquivo inválido. Use .xlsx"}), 400

@programacao_bp.route("/gerar_programacao", methods=["POST"])
def gerar_programacao_route():
    logger.info("Iniciando a geração de programação - Rota /gerar_programacao chamada.")
    global setup_df, faltas_df, cadastro_moldes_df

    if cadastro_moldes_df is None:
        logger.info("DataFrame 'cadastro_moldes_df' não está em memória. Tentando carregar do cache.")
        cadastro_moldes_df = carregar_cache(CACHE_FILE_CADASTRO)
        if cadastro_moldes_df is not None:
            logger.info("DataFrame 'cadastro_moldes_df' carregado do cache com sucesso.")
        else:
            logger.warning("Cache 'cadastro_moldes_df' não encontrado.")

    if setup_df is None or faltas_df is None:
        logger.error("As planilhas de Setup e Faltas não foram carregadas.")
        return jsonify({"error": "As planilhas de Setup e Faltas devem ser carregadas."}), 400

    data = request.get_json()
    logger.info(f"Dados de configuração recebidos: {data}")
    if not data:
        logger.error("Dados de configuração não fornecidos no corpo da requisição.")
        return jsonify({"error": "Dados de configuração não fornecidos"}), 400

    try:
        max_dias = int(data.get("dias_programacao", 50))
        if max_dias <= 0:
            logger.error(f"Número de dias inválido: {max_dias}. Deve ser maior que 0.")
            return jsonify({"error": "Número de dias deve ser maior que 0."}), 400
        
        braco_selecionado = data.get("braco_selecionado", "Todos")
        data_inicio_str = data.get("data_inicio") # Novo parâmetro para data de início
        priorizacao_pedidos_str = data.get("priorizacao_pedidos", "")
        modo_sequenciamento = data.get("modo_sequenciamento", "Otimizado")
        incluir_sabados = data.get("incluir_sabados", False)
        incluir_domingos = data.get("incluir_domingos", False)
        logger.info(f"Parâmetros de execução: max_dias={max_dias}, braco_selecionado='{braco_selecionado}', data_inicio='{data_inicio_str}', priorizacao_pedidos='{priorizacao_pedidos_str}', modo_sequenciamento='{modo_sequenciamento}', sabados={incluir_sabados}, domingos={incluir_domingos}")
        
        if braco_selecionado == "Todos":
            logger.info("Processando para todos os braços.")
            bracos_moldes = setup_df.copy()
        else:
            logger.info(f"Filtrando para o braço selecionado: {braco_selecionado}")
            bracos_moldes = setup_df[setup_df["CODBRACO"] == int(braco_selecionado)].copy()
        
        if bracos_moldes.empty:
            logger.error(f"Nenhum dado encontrado para o braço selecionado: {braco_selecionado}")
            return jsonify({"error": f"Nenhum dado encontrado para o braço selecionado: {braco_selecionado}"}), 400
        logger.info(f"Encontrados {len(bracos_moldes)} registros de moldes para os braços selecionados.")

        # Criar um mapa de CODGRUPOPROD para QTDMOL para consulta rápida.
        # Usamos groupby().sum() para agregar corretamente a quantidade de moldes
        # caso um mesmo produto esteja configurado em mais de um braço.
        mold_quantity_map = setup_df.groupby('CODGRUPOPROD')['QTDMOL'].sum().to_dict() if setup_df is not None and not setup_df.empty else {}


        priorizacao_pedidos = []
        if priorizacao_pedidos_str.strip():
            priorizacao_pedidos = [int(p.strip()) for p in priorizacao_pedidos_str.split(",") if p.strip().isdigit()]
        logger.info(f"Pedidos a serem priorizados: {priorizacao_pedidos}")

        faltas_ordenadas = faltas_df.copy()
        faltas_ordenadas["Prioridade"] = faltas_ordenadas["NUNOTA"].apply(lambda x: 0 if x in priorizacao_pedidos else 1)
        faltas_ordenadas = faltas_ordenadas.sort_values(by=["Prioridade", "NUNOTA", "COR"]).copy()
        faltas_ordenadas["Quantidade que Falta Programar"] = faltas_ordenadas["QTDNEG"]
        faltas_ordenadas["Quantidade Programada"] = 0
        logger.info("DataFrame 'faltas_df' copiado e preparado para ordenação e programação.")
        logger.info(f"Total de {len(faltas_ordenadas)} itens de falta a serem programados.")

        rodadas_resultado = []
        moldes_ociosos_list = []
        necessidade_sem_moldes_list = []
        
        # Usa a data de início fornecida pelo usuário, ou a data atual como padrão.
        # Isso garante que o planejamento comece a partir da data correta.
        if data_inicio_str:
            data_inicial = datetime.strptime(data_inicio_str, "%Y-%m-%d")
            logger.info(f"Data de início da programação definida pelo usuário: {data_inicial.strftime('%Y-%m-%d')}")
        else:
            data_inicial = datetime.now()
            logger.info(f"Data de início da programação não fornecida, usando data atual: {data_inicial.strftime('%Y-%m-%d')}")

        capacidade_total_por_braco = {}
        logger.info("Calculando capacidade total por braço...")
        for _, braco_info in bracos_moldes.groupby("CODBRACO"):
            cod_braco = braco_info.iloc[0]["CODBRACO"]
            qtd_capacidade_rodadas = int(braco_info.iloc[0]["QTDRODADAS"])
            capacidade_total_por_braco[cod_braco] = qtd_capacidade_rodadas * max_dias
            logger.info(f"Braço {cod_braco}: {qtd_capacidade_rodadas} rodadas/dia * {max_dias} dias = {capacidade_total_por_braco[cod_braco]} rodadas no total.")
        
        capacidade_alocada_por_rodada = {}

        logger.info(f"Iniciando sequenciamento no modo: {modo_sequenciamento}")
        if modo_sequenciamento == "Linear":
            logger.info("Entrando no modo de sequenciamento Linear.")
            for _, braco in bracos_moldes.groupby("CODBRACO"):
                logger.info(f"Processando braço {braco.iloc[0]['CODBRACO']} no modo Linear.")
                qtd_capacidade_rodadas = int(braco.iloc[0]["QTDRODADAS"])
                qtd_rodadas_braco = int(braco.iloc[0]["QTDRODADAS"]) * max_dias

                for rodada in range(1, qtd_rodadas_braco + 1):
                    rodada_atual = []
                    for _, molde in braco.iterrows():
                        grupo_produto = molde["CODGRUPOPROD"]
                        moldes_disponiveis_orig = int(molde["QTDMOL"])
                        moldes_disponiveis = moldes_disponiveis_orig
                        falta_grupo = faltas_ordenadas[(faltas_ordenadas["CODGRUPOPROD"] == grupo_produto) & (faltas_ordenadas["Quantidade que Falta Programar"] > 0)]

                        if falta_grupo.empty:
                            if not any(m["Nome"] == molde["DESCRGRUPOPROD"] and m["Braço"] == molde["CODBRACO"] for m in moldes_ociosos_list):
                                ocioso_log = {"Nome": molde["DESCRGRUPOPROD"], "Quantidade": moldes_disponiveis_orig, "Rodada Ociosa": rodada, "Braço": molde["CODBRACO"]}
                                logger.info(f"Molde ocioso detectado e adicionado à lista: {ocioso_log}")
                                moldes_ociosos_list.append(ocioso_log)
                            continue
                        
                        idx_faltas_a_processar = falta_grupo.index.tolist()
                        for index_falta in idx_faltas_a_processar:
                            if moldes_disponiveis <= 0: break
                            if index_falta not in faltas_ordenadas.index or faltas_ordenadas.loc[index_falta, "Quantidade que Falta Programar"] <= 0:
                                continue
                            
                            dias_de_trabalho = math.ceil(rodada / qtd_capacidade_rodadas)
                            data_prevista_calculada = calcular_data_futura(data_inicial, dias_de_trabalho, incluir_sabados, incluir_domingos)
                            falta_total_item = faltas_ordenadas.loc[index_falta, "Quantidade que Falta Programar"]
                            programado = min(falta_total_item, moldes_disponiveis)
                            
                            if programado > 0:
                                faltas_ordenadas.loc[index_falta, "Quantidade Programada"] += programado
                                faltas_ordenadas.loc[index_falta, "Quantidade que Falta Programar"] -= programado
                                moldes_disponiveis -= programado
                                rodada_atual.append({
                                    "Número da Rodada": rodada,
                                    "Data Prevista": data_prevista_calculada.strftime("%d/%m/%Y"),
                                    "Braço": molde["CODBRACO"],
                                    "Produto": faltas_ordenadas.loc[index_falta, "DESCRGRUPOPROD"],
                                    "Cor": faltas_ordenadas.loc[index_falta, "COR"],
                                    "Pedido": faltas_ordenadas.loc[index_falta, "NUNOTA"],
                                    "CODPROD": faltas_ordenadas.loc[index_falta, "CODPROD"],
                                    "Quantidade de Moldes": molde["QTDMOL"],
                                    "Quantidade Programada": programado
                                })
                    rodadas_resultado.extend(rodada_atual)

        elif modo_sequenciamento == "Otimizado":
            logger.info("Entrando no modo de sequenciamento Otimizado.")
            capacidade_por_braco_dict = bracos_moldes.set_index('CODBRACO')['QTDRODADAS'].to_dict()
            if not capacidade_por_braco_dict:
                logger.error("Nenhuma capacidade de rodadas definida para os braços selecionados.")
                return jsonify({"error": "Nenhuma capacidade de rodadas definida para os braços selecionados."}), 400
            
            data_limite = calcular_data_futura(data_inicial, max_dias, incluir_sabados, incluir_domingos)
            rodada_num = 1
            while faltas_ordenadas["Quantidade que Falta Programar"].sum() > 0:
                logger.info(f"Iniciando rodada de otimização número: {rodada_num}. Faltas restantes: {faltas_ordenadas['Quantidade que Falta Programar'].sum()}")
                houve_programacao_na_rodada = False
                capacidade_alocada_por_rodada[rodada_num] = {}
                for cod_braco in capacidade_total_por_braco.keys():
                    capacidade_alocada_por_rodada[rodada_num][cod_braco] = {}

                rodada_atual_items = []
                faltas_indices_a_processar = faltas_ordenadas[faltas_ordenadas["Quantidade que Falta Programar"] > 0].index.tolist()
                
                for index_falta in faltas_indices_a_processar:
                    falta_item = faltas_ordenadas.loc[index_falta]
                    grupo_produto_falta = falta_item["CODGRUPOPROD"]
                    qtd_a_programar = falta_item["Quantidade que Falta Programar"]
                    if qtd_a_programar <= 0: continue

                    moldes_aplicaveis = bracos_moldes[bracos_moldes["CODGRUPOPROD"] == grupo_produto_falta]
                    for _, molde_info in moldes_aplicaveis.iterrows():
                        cod_braco_molde = molde_info["CODBRACO"]
                        capacidade_braco = capacidade_por_braco_dict.get(cod_braco_molde, 1)
                        if capacidade_braco <= 0: capacidade_braco = 1
                        
                        dia_calculado = math.ceil(rodada_num / capacidade_braco)
                        data_prevista_calculada_dt = calcular_data_futura(data_inicial, dia_calculado, incluir_sabados, incluir_domingos)
                        if data_prevista_calculada_dt > data_limite: continue

                        qtd_total_moldes_molde = int(molde_info["QTDMOL"])
                        moldes_ja_alocados_nesse_braco = capacidade_alocada_por_rodada[rodada_num].get(cod_braco_molde, {}).get(grupo_produto_falta, 0)
                        capacidade_disponivel_molde = qtd_total_moldes_molde - moldes_ja_alocados_nesse_braco
                        if capacidade_disponivel_molde <= 0: continue

                        programado = min(qtd_a_programar, capacidade_disponivel_molde)
                        if programado > 0:
                            houve_programacao_na_rodada = True
                            faltas_ordenadas.at[index_falta, "Quantidade Programada"] += programado
                            faltas_ordenadas.at[index_falta, "Quantidade que Falta Programar"] -= programado
                            qtd_a_programar -= programado
                            
                            if cod_braco_molde not in capacidade_alocada_por_rodada[rodada_num]:
                                capacidade_alocada_por_rodada[rodada_num][cod_braco_molde] = {}
                            if grupo_produto_falta not in capacidade_alocada_por_rodada[rodada_num][cod_braco_molde]:
                                capacidade_alocada_por_rodada[rodada_num][cod_braco_molde][grupo_produto_falta] = 0
                            capacidade_alocada_por_rodada[rodada_num][cod_braco_molde][grupo_produto_falta] += programado
                            
                            data_prevista_calculada = data_prevista_calculada_dt.strftime("%d/%m/%Y")
                            
                            rodada_item = {
                                "Número da Rodada": rodada_num,
                                "Data Prevista": data_prevista_calculada,
                                "Braço": cod_braco_molde,
                                "Produto": falta_item["DESCRGRUPOPROD"],
                                "Cor": falta_item["COR"],
                                "Pedido": falta_item["NUNOTA"],
                                "CODPROD": falta_item["CODPROD"],
                                "Quantidade de Moldes": molde_info["QTDMOL"],
                                "Quantidade Programada": programado
                            }
                            logger.info(f"Item de programação gerado (Otimizado): {rodada_item}")
                            rodada_atual_items.append(rodada_item)
                            
                            if qtd_a_programar <= 0: break
                
                rodadas_resultado.extend(rodada_atual_items)
                if not houve_programacao_na_rodada:
                    logger.warning(f"Nenhuma programação foi possível na rodada {rodada_num}. Interrompendo o loop de otimização.")
                    break
                rodada_num += 1
            
            logger.info("Loop de otimização concluído. Verificando moldes ociosos...")
            for _, molde_config in bracos_moldes.iterrows():
                grupo_prod_molde = molde_config["CODGRUPOPROD"]
                cod_braco_molde = molde_config["CODBRACO"]
                qtd_molde_total = int(molde_config["QTDMOL"])
                foi_usado_alguma_vez = False
                for r_num, alocacoes_braco in capacidade_alocada_por_rodada.items():
                    if cod_braco_molde in alocacoes_braco and grupo_prod_molde in alocacoes_braco[cod_braco_molde] and alocacoes_braco[cod_braco_molde][grupo_prod_molde] > 0:
                        foi_usado_alguma_vez = True
                        break
                
                ainda_tem_faltas_para_grupo = not faltas_ordenadas[(faltas_ordenadas["CODGRUPOPROD"] == grupo_prod_molde) & (faltas_ordenadas["Quantidade que Falta Programar"] > 0)].empty
                
                if not foi_usado_alguma_vez and not ainda_tem_faltas_para_grupo:
                    ocioso_log = {
                        "Nome": molde_config["DESCRGRUPOPROD"],
                        "Quantidade": qtd_molde_total,
                        "Rodada Ociosa": "Desde o início (sem demanda ou uso)", 
                        "Braço": cod_braco_molde
                    }
                    logger.info(f"Molde ocioso (sem uso) detectado: {ocioso_log}")
                    moldes_ociosos_list.append(ocioso_log)

        else:
            logger.error(f"Modo de sequenciamento inválido: {modo_sequenciamento}")
            return jsonify({"error": "Modo de sequenciamento inválido."}), 400

        logger.info("Verificando necessidades de produtos sem moldes configurados...")
        produtos_sem_molde_df = faltas_ordenadas[faltas_ordenadas["Quantidade que Falta Programar"] > 0]
        
        for _, produto_faltante in produtos_sem_molde_df.iterrows():
            # Adicionado para ignorar linhas com dados essenciais ausentes (NaN), comum em linhas de total no Excel
            if pd.isna(produto_faltante["CODGRUPOPROD"]) or pd.isna(produto_faltante["DESCRGRUPOPROD"]):
                logger.warning(f"Ignorando linha de 'necessidades' com dados ausentes (provável linha de total): {produto_faltante.to_dict()}")
                continue

            # A lógica agora inclui todos os produtos com falta, não apenas os sem molde no setup.
            qtd_moldes_cadastrados = 0
            if cadastro_moldes_df is not None:
                cadastro_filtro = cadastro_moldes_df[cadastro_moldes_df["DESCRPROD"] == produto_faltante["DESCRGRUPOPROD"]]
                if not cadastro_filtro.empty:
                    if "Qtd. Moldes" in cadastro_filtro.columns:
                        qtd_moldes_cadastrados = pd.to_numeric(cadastro_filtro["Qtd. Moldes"], errors='coerce').fillna(0).astype(int).sum()
                    elif "QTDMOL" in cadastro_filtro.columns:
                        qtd_moldes_cadastrados = pd.to_numeric(cadastro_filtro["QTDMOL"], errors='coerce').fillna(0).astype(int).sum()
            
            # Usa o mapa criado no início para obter a quantidade de moldes instalados.
            qtd_moldes_instalados = mold_quantity_map.get(produto_faltante["CODGRUPOPROD"], 0)

            necessidade_item = {
                "Nome": produto_faltante["DESCRGRUPOPROD"],
                "Produto": produto_faltante["DESCRGRUPOPROD"], # Adicionando para consistência
                "Pedido": produto_faltante["NUNOTA"],
                "Cor": produto_faltante["COR"],
                "Quantidade": produto_faltante["Quantidade que Falta Programar"],
                "Qtd. Moldes Cadastrados": qtd_moldes_cadastrados,
                "Qtd. Moldes Instalados": int(qtd_moldes_instalados)
            }
            necessidade_sem_moldes_list.append(necessidade_item)
        
        moldes_ociosos_list.sort(key=lambda x: (isinstance(x["Rodada Ociosa"], str), x["Rodada Ociosa"], x["Braço"]))

        programacao_final_df = pd.DataFrame(rodadas_resultado)
        moldes_ociosos_df = pd.DataFrame(moldes_ociosos_list)
        necessidade_sem_moldes_df = pd.DataFrame(necessidade_sem_moldes_list)

        # --- CORREÇÃO PARA EVITAR ERRO DE JSON 'NaN' ---
        # Substitui NaN por None, que é convertido para 'null' em JSON.
        if not programacao_final_df.empty:
            programacao_final_df = programacao_final_df.where(pd.notna(programacao_final_df), None)
        if not moldes_ociosos_df.empty:
            moldes_ociosos_df = moldes_ociosos_df.where(pd.notna(moldes_ociosos_df), None)
        if not necessidade_sem_moldes_df.empty:
            necessidade_sem_moldes_df = necessidade_sem_moldes_df.where(pd.notna(necessidade_sem_moldes_df), None)

        logger.info("Gerando arquivos de saída Excel.")
        output_dir = "/tmp/programacao_output"
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        prog_filename = f"programacao_gerada_{timestamp}.xlsx"
        ociosos_filename = f"moldes_ociosos_{timestamp}.xlsx"
        necessidade_filename = f"necessidade_sem_moldes_{timestamp}.xlsx"
        prog_filepath = os.path.join(output_dir, prog_filename)
        ociosos_filepath = os.path.join(output_dir, ociosos_filename)
        necessidade_filepath = os.path.join(output_dir, necessidade_filename)

        if not programacao_final_df.empty:
            programacao_final_df.to_excel(prog_filepath, index=False)
            logger.info(f"Arquivo de programação salvo em: {prog_filepath}")
        else:
            pd.DataFrame().to_excel(prog_filepath, index=False)
            logger.info("Nenhuma programação gerada, arquivo de programação vazio salvo.")
        if not moldes_ociosos_df.empty:
            moldes_ociosos_df.to_excel(ociosos_filepath, index=False)
            logger.info(f"Arquivo de moldes ociosos salvo em: {ociosos_filepath}")
        else:
            pd.DataFrame().to_excel(ociosos_filepath, index=False)
            logger.info("Nenhum molde ocioso, arquivo de ociosos vazio salvo.")
        if not necessidade_sem_moldes_df.empty:
            necessidade_sem_moldes_df.to_excel(necessidade_filepath, index=False)
            logger.info(f"Arquivo de necessidade sem moldes salvo em: {necessidade_filepath}")
        else:
            pd.DataFrame().to_excel(necessidade_filepath, index=False)
            logger.info("Nenhuma necessidade sem molde, arquivo de necessidade vazio salvo.")

        # Save program result to MongoDB
        try:
            program_result_doc = {
                "timestamp": datetime.now(),
                # Salva os parâmetros de configuração para rastreabilidade
                "braco_selecionado": braco_selecionado,
                "dias_programacao": max_dias,
                "modo_sequenciamento": modo_sequenciamento,
                "data_inicio": data_inicio_str,
                "priorizacao_pedidos": priorizacao_pedidos_str,
                "programacao_data": programacao_final_df.to_dict(orient="records") if not programacao_final_df.empty else [],
                "moldes_ociosos_data": moldes_ociosos_df.to_dict(orient="records") if not moldes_ociosos_df.empty else [],
                "necessidade_sem_moldes_data": necessidade_sem_moldes_df.to_dict(orient="records") if not necessidade_sem_moldes_df.empty else [],
                "programacao_gerada_url": f"/api/programacao/download/{prog_filename}",
                "moldes_ociosos_url": f"/api/programacao/download/{ociosos_filename}",
                "necessidade_sem_moldes_url": f"/api/programacao/download/{necessidade_filename}"
            }
            logger.info("Salvando resultado da programação no MongoDB.")
            programacao_results_collection.insert_one(program_result_doc)
            logger.info("Resultado da programação salvo no MongoDB com sucesso.")
        except Exception as e:
            logger.exception("Erro ao salvar resultado da programação no MongoDB.")

        logger.info("Geração de programação concluída com sucesso. Retornando resposta.")
        return jsonify({
            "message": "Programação gerada com sucesso!",
            "programacao_gerada_url": f"/api/programacao/download/{prog_filename}",
            "moldes_ociosos_url": f"/api/programacao/download/{ociosos_filename}",
            "necessidade_sem_moldes_url": f"/api/programacao/download/{necessidade_filename}",
            "programacao_data": programacao_final_df.to_dict(orient="records") if not programacao_final_df.empty else [],
            "moldes_ociosos_data": moldes_ociosos_df.to_dict(orient="records") if not moldes_ociosos_df.empty else [],
            "necessidade_sem_moldes_data": necessidade_sem_moldes_df.to_dict(orient="records") if not necessidade_sem_moldes_df.empty else [],
            # Retorna os parâmetros de configuração para o frontend
            "dias_programacao": max_dias,
            "braco_selecionado": braco_selecionado,
            "modo_sequenciamento": modo_sequenciamento,
            "data_inicio": data_inicio_str,
            "priorizacao_pedidos": priorizacao_pedidos_str
        }), 200

    except ValueError as ve:
        logger.exception(f"Erro de valor nos dados de entrada: {ve}")
        return jsonify({"error": f"Erro de valor nos dados de entrada: {ve}"}), 400
    except KeyError as ke:
        logger.exception(f"Erro de chave nos dados das planilhas (verifique os nomes das colunas): {ke}")
        return jsonify({"error": f"Erro de chave nos dados das planilhas (verifique os nomes das colunas): {ke}"}), 400
    except Exception as e:
        logger.exception("Ocorreu um erro inesperado ao gerar a programação.")
        return jsonify({"error": f"Erro ao gerar programação: {e}"}), 500

@programacao_bp.route("/download/<filename>", methods=["GET"])
def download_file(filename):
    logger.info(f"Rota /download/{filename} chamada.")
    file_path = os.path.join("/tmp/programacao_output", filename)
    if os.path.exists(file_path):
        logger.info(f"Arquivo '{filename}' encontrado. Enviando para o cliente.")
        return send_file(file_path, as_attachment=True)
    logger.error(f"Arquivo '{filename}' não encontrado no caminho: {file_path}")
    return jsonify({"error": "Arquivo não encontrado"}), 404

@programacao_bp.route("/salvar_programacao", methods=["POST"])
def salvar_programacao():
    logger.info("Rota /salvar_programacao chamada.")
    try:
        dados = request.get_json()
        if not dados:
            logger.error("Nenhum dado JSON recebido em /salvar_programacao.")
            return jsonify({"error": "Dados de programação não fornecidos"}), 400

        # Add a timestamp to the data
        dados["timestamp"] = datetime.now()
        logger.info("Salvando programação no MongoDB. Dados com timestamp adicionado.")

        # Insert the data into the collection
        programacao_results_collection.insert_one(dados)
        logger.info("Programação salva com sucesso no MongoDB.")

        return jsonify({"message": "Programação salva com sucesso!"}), 200
    except Exception as e:
        logger.exception("Erro ao salvar programação no MongoDB.")
        return jsonify({"error": f"Erro ao salvar programação: {e}"}), 500

@programacao_bp.route("/obter_historico", methods=["GET"])
def get_historico():
    logger.info("Rota /obter_historico chamada.")
    try:
        # Projeção otimizada para retornar APENAS os campos necessários para a listagem do histórico.
        # Isso torna a resposta da API extremamente leve e rápida.
        projection = {
            "_id": 1,
            "timestamp": 1,
            "tipo": 1,
            "descricao": 1,
            "braco_selecionado": 1
        }

        # Permite que o frontend especifique um limite (ex: ?limit=3 para o dashboard)
        limit = request.args.get('limit', default=0, type=int)

        query = programacao_results_collection.find({}, projection).sort("timestamp", DESCENDING)

        if limit > 0:
            logger.info(f"Buscando histórico de programações no MongoDB com projeção e limite de {limit}.")
            query = query.limit(limit)
        else:
            # Se nenhum limite for passado, retorna todos os registros (útil para a página de Análise Histórica)
            logger.info("Buscando histórico completo de programações no MongoDB com projeção.")

        historico = list(query)

        # Convert ObjectId to string for JSON serialization
        for item in historico:
            item['_id'] = str(item['_id'])

        logger.info(f"Histórico encontrado com {len(historico)} registros.")
        return jsonify({"historico": historico}), 200
    except Exception as e:
        logger.exception("Erro ao carregar histórico do MongoDB.")
        return jsonify({"error": f"Erro ao carregar histórico do MongoDB: {e}"}), 500

@programacao_bp.route("/last_result", methods=["GET"])
def get_last_program_result():
    logger.info("Rota /last_result chamada.")
    last_result = load_last_program_result()
    if last_result:
        logger.info("Último resultado de programação encontrado.")
        return jsonify(last_result), 200
    logger.info("Nenhum resultado de programação anterior encontrado.")
    return jsonify({"message": "Nenhum resultado de programação encontrado."}), 404



# Importações e código para Oracle (sem alterações)

ORACLE_DATABASE_URI = os.getenv("ORACLE_DATABASE_URI")

def get_oracle_engine():
    try:
        engine = create_engine(ORACLE_DATABASE_URI, echo=False)
        return engine
    except Exception as e:
        logger.error(f"Erro ao criar engine Oracle: {str(e)}")
        raise

def filtrar_primeiros_tres_dias(dados_programacao):
    logger.info(f"Filtrando os 3 primeiros dias de {len(dados_programacao)} registros.")
    if not dados_programacao:
        return []
    
    dados_com_data = []
    for item in dados_programacao:
        try:
            data_obj = datetime.strptime(item['Data Prevista'], '%d/%m/%Y').date()
            item_copy = item.copy()
            item_copy['data_obj'] = data_obj
            dados_com_data.append(item_copy)
        except (ValueError, TypeError):
            logger.warning(f"Erro ao converter data para o item: {item}. Ignorando registro.")
            continue
    
    dados_com_data.sort(key=lambda x: x['data_obj'])
    logger.info("Dados de programação ordenados por data.")
    
    datas_unicas = []
    for item in dados_com_data:
        if item['data_obj'] not in datas_unicas:
            datas_unicas.append(item['data_obj'])
        if len(datas_unicas) >= 3:
            break
    
    logger.info(f"Datas únicas encontradas para filtragem: {datas_unicas[:3]}")
    dados_filtrados = []
    for item in dados_com_data:
        if item['data_obj'] in datas_unicas[:3]:
            item_filtrado = {k: v for k, v in item.items() if k != 'data_obj'}
            dados_filtrados.append(item_filtrado)
    
    return dados_filtrados

@programacao_bp.route("/enviar_sankhya", methods=["POST"])
def enviar_sankhya():
    logger.info("Iniciando envio para o Sankhya - Rota /enviar_sankhya chamada.")
    try:
        dados = request.get_json()
        if not dados or 'programacao_data' not in dados:
            logger.error("Dados de programação não fornecidos na requisição para /enviar_sankhya.")
            return jsonify({"error": "Dados de programação não fornecidos"}), 400
        
        programacao_data = dados['programacao_data']
        if not programacao_data:
            logger.warning("Nenhum dado de programação encontrado para enviar ao Sankhya.")
            return jsonify({"error": "Nenhum dado de programação encontrado"}), 400
        
        logger.info(f"Recebidos {len(programacao_data)} registros de programação. Filtrando os 3 primeiros dias.")
        dados_filtrados = filtrar_primeiros_tres_dias(programacao_data)
        if not dados_filtrados:
            logger.warning("Nenhum dado válido encontrado nos 3 primeiros dias para enviar ao Sankhya.")
            return jsonify({"error": "Nenhum dado válido encontrado nos 3 primeiros dias"}), 400
        
        logger.info(f"Enviando {len(dados_filtrados)} registros para o Sankhya")
        
        engine = get_oracle_engine()
        registros_inseridos = 0
        registros_com_erro = 0
        
        with engine.connect() as connection:
            with connection.begin(): # Usar transação
                logger.info("Buscando próximo NUPLAN da tabela AD_PLAN.")
                result = connection.execute(text("SELECT NVL(MAX(NUPLAN), 0) + 1 as next_nuplan FROM AD_PLAN"))
                next_nuplan = result.scalar() or 1
                logger.info(f"Próximo NUPLAN a ser utilizado: {next_nuplan}")
                
                for i, item in enumerate(dados_filtrados):
                    try:
                        data_prevista = datetime.strptime(item['Data Prevista'], '%d/%m/%Y').date()
                        data_inclusao = datetime.now()
                        
                        insert_data = {
                            'nuplan': next_nuplan + i,
                            'rodada': item.get('Número da Rodada'),
                            'dtprev': data_prevista,
                            'braco': item.get('Braço'),
                            'codprod': item.get('CODPROD'),
                            'descrprod': str(item.get('Produto', ''))[:255],
                            'cor': str(item.get('Cor', ''))[:100] if item.get('Cor') else None,
                            'pedido': item.get('Pedido'),
                            'qtdmolde': item.get('Quantidade de Moldes'),
                            'qtdplan': item.get('Quantidade Programada'),
                            'idiproc': None,
                            'dtinc': data_inclusao
                        }
                        logger.info(f"Dados a serem inseridos no Sankhya: {insert_data}")
                        
                        insert_sql = text("""
                            INSERT INTO AD_PLAN (NUPLAN, RODADA, DTPREV, BRACO, CODPROD, DESCRPROD, COR, PEDIDO, QTDMOLDE, QTDPLAN, IDIPROC, DTINC)
                            VALUES (:nuplan, :rodada, :dtprev, :braco, :codprod, :descrprod, :cor, :pedido, :qtdmolde, :qtdplan, :idiproc, :dtinc)
                        """)
                        
                        connection.execute(insert_sql, insert_data)
                        registros_inseridos += 1
                        logger.info(f"Registro {i+1} inserido com sucesso.")
                        
                    except Exception as e:
                        logger.error(f"Erro ao inserir registro {i+1} ({item}): {str(e)}")
                        registros_com_erro += 1
                        continue
        
        logger.info(f"Envio concluído: {registros_inseridos} registros inseridos, {registros_com_erro} com erro")
        
        return jsonify({
            "message": f"Dados enviados com sucesso para o Sankhya!",
            "registros_inseridos": registros_inseridos,
            "registros_com_erro": registros_com_erro,
            "total_registros_processados": len(dados_filtrados)
        }), 200
        
    except SQLAlchemyError as e:
        logger.exception("Erro de banco de dados ao enviar para Sankhya.")
        return jsonify({"error": f"Erro de conexão com o banco de dados: {str(e)}"}), 500
    except Exception as e:
        logger.exception("Erro geral ao enviar para Sankhya.")
        return jsonify({"error": f"Erro ao enviar dados para o Sankhya: {str(e)}"}), 500