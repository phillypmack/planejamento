from flask import Blueprint, request, jsonify, send_file
import pandas as pd
import os
from datetime import datetime, timedelta
import math
import pickle
import json
from pymongo import MongoClient, DESCENDING
from dotenv import load_dotenv

load_dotenv()

# MongoDB Atlas Connection
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client.planejamento_db # Using a new database name for planning
programacao_results_collection = db.programacao_results

# Index creation
def create_indexes():
    try:
        programacao_results_collection.create_index([("timestamp", DESCENDING)])
        print("Index on 'timestamp' created successfully.")
    except Exception as e:
        print(f"Error creating index: {e}")

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


@programacao_bp.route("/upload_setup", methods=["POST"])
def upload_setup():
    global setup_df
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Nome de arquivo vazio"}), 400
    if file and file.filename.endswith(".xlsx"):
        try:
            setup_df = pd.read_excel(file)
            return jsonify({"message": "Planilha de Setup carregada com sucesso!"}), 200
        except Exception as e:
            return jsonify({"error": f"Erro ao carregar planilha de Setup: {e}"}), 500
    return jsonify({"error": "Formato de arquivo inválido. Use .xlsx"}), 400

@programacao_bp.route("/upload_faltas", methods=["POST"])
def upload_faltas():
    global faltas_df
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Nome de arquivo vazio"}), 400
    if file and file.filename.endswith(".xlsx"):
        try:
            faltas_df = pd.read_excel(file)
            return jsonify({"message": "Planilha de Faltas carregada com sucesso!"}), 200
        except Exception as e:
            return jsonify({"error": f"Erro ao carregar planilha de Faltas: {e}"}), 500
    return jsonify({"error": "Formato de arquivo inválido. Use .xlsx"}), 400

@programacao_bp.route("/upload_cadastro_moldes", methods=["POST"])
def upload_cadastro_moldes():
    global cadastro_moldes_df
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Nome de arquivo vazio"}), 400
    if file and file.filename.endswith(".xlsx"):
        try:
            cadastro_moldes_df = pd.read_excel(file)
            salvar_cache(cadastro_moldes_df, CACHE_FILE_CADASTRO)
            return jsonify({"message": "Cadastro de Moldes carregado com sucesso!"}), 200
        except Exception as e:
            return jsonify({"error": f"Erro ao carregar cadastro de moldes: {e}"}), 500
    return jsonify({"error": "Formato de arquivo inválido. Use .xlsx"}), 400

@programacao_bp.route("/gerar_programacao", methods=["POST"])
def gerar_programacao_route():
    global setup_df, faltas_df, cadastro_moldes_df

    if cadastro_moldes_df is None:
        cadastro_moldes_df = carregar_cache(CACHE_FILE_CADASTRO)

    if setup_df is None or faltas_df is None:
        return jsonify({"error": "As planilhas de Setup e Faltas devem ser carregadas."}), 400

    data = request.get_json()
    if not data:
        return jsonify({"error": "Dados de configuração não fornecidos"}), 400

    try:
        max_dias = int(data.get("dias_programacao", 10))
        if max_dias <= 0:
            return jsonify({"error": "Número de dias deve ser maior que 0."}), 400
        
        braco_selecionado = data.get("braco_selecionado", "Todos")
        priorizacao_pedidos_str = data.get("priorizacao_pedidos", "")
        modo_sequenciamento = data.get("modo_sequenciamento", "Otimizado")

        if braco_selecionado == "Todos":
            bracos_moldes = setup_df.copy()
        else:
            bracos_moldes = setup_df[setup_df["CODBRACO"] == int(braco_selecionado)].copy()
        
        if bracos_moldes.empty:
            return jsonify({"error": f"Nenhum dado encontrado para o braço selecionado: {braco_selecionado}"}), 400

        priorizacao_pedidos = []
        if priorizacao_pedidos_str.strip():
            priorizacao_pedidos = [int(p.strip()) for p in priorizacao_pedidos_str.split(",") if p.strip().isdigit()]

        faltas_ordenadas = faltas_df.copy()
        faltas_ordenadas["Prioridade"] = faltas_ordenadas["NUNOTA"].apply(lambda x: 0 if x in priorizacao_pedidos else 1)
        faltas_ordenadas = faltas_ordenadas.sort_values(by=["Prioridade", "NUNOTA", "COR"]).copy()
        faltas_ordenadas["Quantidade que Falta Programar"] = faltas_ordenadas["QTDNEG"]
        faltas_ordenadas["Quantidade Programada"] = 0

        rodadas_resultado = []
        moldes_ociosos_list = []
        necessidade_sem_moldes_list = []
        data_inicial = datetime.now()
        capacidade_total_por_braco = {}
        for _, braco_info in bracos_moldes.groupby("CODBRACO"):
            cod_braco = braco_info.iloc[0]["CODBRACO"]
            qtd_capacidade_rodadas = int(braco_info.iloc[0]["QTDRODADAS"])
            capacidade_total_por_braco[cod_braco] = qtd_capacidade_rodadas * max_dias
        
        capacidade_alocada_por_rodada = {}

        if modo_sequenciamento == "Linear":
            for _, braco in bracos_moldes.groupby("CODBRACO"):
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
                                moldes_ociosos_list.append({"Nome": molde["DESCRGRUPOPROD"], "Quantidade": moldes_disponiveis_orig, "Rodada Ociosa": rodada, "Braço": molde["CODBRACO"]})
                            continue
                        
                        idx_faltas_a_processar = falta_grupo.index.tolist()
                        for index_falta in idx_faltas_a_processar:
                            if moldes_disponiveis <= 0: break
                            if index_falta not in faltas_ordenadas.index or faltas_ordenadas.loc[index_falta, "Quantidade que Falta Programar"] <= 0:
                                continue

                            falta_total_item = faltas_ordenadas.loc[index_falta, "Quantidade que Falta Programar"]
                            programado = min(falta_total_item, moldes_disponiveis)
                            
                            if programado > 0:
                                faltas_ordenadas.loc[index_falta, "Quantidade Programada"] += programado
                                faltas_ordenadas.loc[index_falta, "Quantidade que Falta Programar"] -= programado
                                moldes_disponiveis -= programado
                                rodada_atual.append({
                                    "Número da Rodada": rodada,
                                    "Data Prevista": (data_inicial + timedelta(days=math.ceil((rodada - 1) / qtd_capacidade_rodadas))).strftime("%d/%m/%Y"),
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
            capacidade_por_braco_dict = bracos_moldes.set_index('CODBRACO')['QTDRODADAS'].to_dict()
            if not capacidade_por_braco_dict:
                return jsonify({"error": "Nenhuma capacidade de rodadas definida para os braços selecionados."}), 400

            rodada_num = 1
            while faltas_ordenadas["Quantidade que Falta Programar"].sum() > 0:
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

                        if dia_calculado > max_dias: continue

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
                            
                            data_prevista_calculada = (data_inicial + timedelta(days=dia_calculado - 1)).strftime("%d/%m/%Y")
                            
                            rodada_atual_items.append({
                                "Número da Rodada": rodada_num,
                                "Data Prevista": data_prevista_calculada,
                                "Braço": cod_braco_molde,
                                "Produto": falta_item["DESCRGRUPOPROD"],
                                "Cor": falta_item["COR"],
                                "Pedido": falta_item["NUNOTA"],
                                "CODPROD": falta_item["CODPROD"],
                                "Quantidade de Moldes": molde_info["QTDMOL"],
                                "Quantidade Programada": programado
                            })
                            
                            if qtd_a_programar <= 0: break
                
                rodadas_resultado.extend(rodada_atual_items)
                if not houve_programacao_na_rodada: break
                rodada_num += 1
            
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
                    moldes_ociosos_list.append({
                        "Nome": molde_config["DESCRGRUPOPROD"],
                        "Quantidade": qtd_molde_total,
                        "Rodada Ociosa": "Desde o início (sem demanda ou uso)", 
                        "Braço": cod_braco_molde
                    })

        else:
            return jsonify({"error": "Modo de sequenciamento inválido."}), 400

        produtos_sem_molde_df = faltas_ordenadas[faltas_ordenadas["Quantidade que Falta Programar"] > 0]
        for _, produto_faltante in produtos_sem_molde_df.iterrows():
            if produto_faltante["CODGRUPOPROD"] not in setup_df["CODGRUPOPROD"].values:
                qtd_moldes_cadastrados = 0
                if cadastro_moldes_df is not None:
                    cadastro_filtro = cadastro_moldes_df[cadastro_moldes_df["DESCRPROD"] == produto_faltante["DESCRGRUPOPROD"]]
                    if not cadastro_filtro.empty:
                        if "Qtd. Moldes" in cadastro_filtro.columns:
                            qtd_moldes_cadastrados = pd.to_numeric(cadastro_filtro["Qtd. Moldes"], errors='coerce').fillna(0).astype(int).sum()
                        elif "QTDMOL" in cadastro_filtro.columns:
                            qtd_moldes_cadastrados = pd.to_numeric(cadastro_filtro["QTDMOL"], errors='coerce').fillna(0).astype(int).sum()
                necessidade_sem_moldes_list.append({
                    "Nome": produto_faltante["DESCRGRUPOPROD"],
                    "Quantidade": produto_faltante["Quantidade que Falta Programar"],
                    "Qtd. Moldes Cadastrados": qtd_moldes_cadastrados
                })
        
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
        else:
            pd.DataFrame().to_excel(prog_filepath, index=False)
        if not moldes_ociosos_df.empty:
            moldes_ociosos_df.to_excel(ociosos_filepath, index=False)
        else:
            pd.DataFrame().to_excel(ociosos_filepath, index=False)
        if not necessidade_sem_moldes_df.empty:
            necessidade_sem_moldes_df.to_excel(necessidade_filepath, index=False)
        else:
            pd.DataFrame().to_excel(necessidade_filepath, index=False)

        # Save program result to MongoDB
        try:
            program_result_doc = {
                "timestamp": datetime.now(),
                "programacao_data": programacao_final_df.to_dict(orient="records") if not programacao_final_df.empty else [],
                "moldes_ociosos_data": moldes_ociosos_df.to_dict(orient="records") if not moldes_ociosos_df.empty else [],
                "necessidade_sem_moldes_data": necessidade_sem_moldes_df.to_dict(orient="records") if not necessidade_sem_moldes_df.empty else [],
                "programacao_gerada_url": f"/api/programacao/download/{prog_filename}",
                "moldes_ociosos_url": f"/api/programacao/download/{ociosos_filename}",
                "necessidade_sem_moldes_url": f"/api/programacao/download/{necessidade_filename}"
            }
            programacao_results_collection.insert_one(program_result_doc)
            print("Program result saved to MongoDB successfully.")
        except Exception as e:
            print(f"Error saving program result to MongoDB: {e}")

        return jsonify({
            "message": "Programação gerada com sucesso!",
            "programacao_gerada_url": f"/api/programacao/download/{prog_filename}",
            "moldes_ociosos_url": f"/api/programacao/download/{ociosos_filename}",
            "necessidade_sem_moldes_url": f"/api/programacao/download/{necessidade_filename}",
            "programacao_data": programacao_final_df.to_dict(orient="records") if not programacao_final_df.empty else [],
            "moldes_ociosos_data": moldes_ociosos_df.to_dict(orient="records") if not moldes_ociosos_df.empty else [],
            "necessidade_sem_moldes_data": necessidade_sem_moldes_df.to_dict(orient="records") if not necessidade_sem_moldes_df.empty else []
        }), 200

    except ValueError as ve:
        return jsonify({"error": f"Erro de valor nos dados de entrada: {ve}"}), 400
    except KeyError as ke:
        return jsonify({"error": f"Erro de chave nos dados das planilhas (verifique os nomes das colunas): {ke}"}), 400
    except Exception as e:
        return jsonify({"error": f"Erro ao gerar programação: {e}"}), 500

@programacao_bp.route("/download/<filename>", methods=["GET"])
def download_file(filename):
    file_path = os.path.join("/tmp/programacao_output", filename)
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return jsonify({"error": "Arquivo não encontrado"}), 404

@programacao_bp.route("/salvar_programacao", methods=["POST"])
def salvar_programacao():
    try:
        dados = request.get_json()
        if not dados:
            return jsonify({"error": "Dados de programação não fornecidos"}), 400

        # Add a timestamp to the data
        dados["timestamp"] = datetime.now()

        # Insert the data into the collection
        programacao_results_collection.insert_one(dados)

        return jsonify({"message": "Programação salva com sucesso!"}), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao salvar programação: {e}"}), 500

@programacao_bp.route("/obter_historico", methods=["GET"])
def get_historico():
    try:
        # Find all documents and sort by timestamp descending
        historico = list(programacao_results_collection.find().sort("timestamp", -1).limit(3))
        
        # Convert ObjectId to string and remove it for JSON serialization
        for item in historico:
            item['_id'] = str(item['_id'])
            
        return jsonify({"historico": historico}), 200
    except Exception as e:
        print(f"Error loading history from MongoDB: {e}")
        return jsonify({"error": f"Erro ao carregar histórico do MongoDB: {e}"}), 500

@programacao_bp.route("/last_result", methods=["GET"])
def get_last_program_result():
    last_result = load_last_program_result()
    if last_result:
        return jsonify(last_result), 200
    return jsonify({"message": "Nenhum resultado de programação encontrado."}), 404



# Importações e código para Oracle (sem alterações)
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ORACLE_DATABASE_URI = os.getenv("ORACLE_DATABASE_URI")

def get_oracle_engine():
    try:
        engine = create_engine(ORACLE_DATABASE_URI, echo=False)
        return engine
    except Exception as e:
        logger.error(f"Erro ao criar engine Oracle: {str(e)}")
        raise

def filtrar_primeiros_tres_dias(dados_programacao):
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
            logger.warning(f"Erro ao converter data {item.get('Data Prevista', 'N/A')}")
            continue
    
    dados_com_data.sort(key=lambda x: x['data_obj'])
    
    datas_unicas = []
    for item in dados_com_data:
        if item['data_obj'] not in datas_unicas:
            datas_unicas.append(item['data_obj'])
        if len(datas_unicas) >= 3:
            break
    
    dados_filtrados = []
    for item in dados_com_data:
        if item['data_obj'] in datas_unicas[:3]:
            item_filtrado = {k: v for k, v in item.items() if k != 'data_obj'}
            dados_filtrados.append(item_filtrado)
    
    return dados_filtrados

@programacao_bp.route("/enviar_sankhya", methods=["POST"])
def enviar_sankhya():
    try:
        dados = request.get_json()
        if not dados or 'programacao_data' not in dados:
            return jsonify({"error": "Dados de programação não fornecidos"}), 400
        
        programacao_data = dados['programacao_data']
        if not programacao_data:
            return jsonify({"error": "Nenhum dado de programação encontrado"}), 400
        
        dados_filtrados = filtrar_primeiros_tres_dias(programacao_data)
        if not dados_filtrados:
            return jsonify({"error": "Nenhum dado válido encontrado nos 3 primeiros dias"}), 400
        
        logger.info(f"Enviando {len(dados_filtrados)} registros para o Sankhya")
        
        engine = get_oracle_engine()
        registros_inseridos = 0
        registros_com_erro = 0
        
        with engine.connect() as connection:
            with connection.begin(): # Usar transação
                result = connection.execute(text("SELECT NVL(MAX(NUPLAN), 0) + 1 as next_nuplan FROM AD_PLAN"))
                next_nuplan = result.scalar() or 1
                
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
                        
                        insert_sql = text("""
                            INSERT INTO AD_PLAN (NUPLAN, RODADA, DTPREV, BRACO, CODPROD, DESCRPROD, COR, PEDIDO, QTDMOLDE, QTDPLAN, IDIPROC, DTINC)
                            VALUES (:nuplan, :rodada, :dtprev, :braco, :codprod, :descrprod, :cor, :pedido, :qtdmolde, :qtdplan, :idiproc, :dtinc)
                        """)
                        
                        connection.execute(insert_sql, insert_data)
                        registros_inseridos += 1
                        
                    except Exception as e:
                        logger.error(f"Erro ao inserir registro {i}: {str(e)}")
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
        logger.error(f"Erro de banco de dados: {str(e)}")
        return jsonify({"error": f"Erro de conexão com o banco de dados: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Erro geral ao enviar para Sankhya: {str(e)}")
        return jsonify({"error": f"Erro ao enviar dados para o Sankhya: {str(e)}"}), 500