import os
from pymongo import MongoClient, DESCENDING
from dotenv import load_dotenv
from pathlib import Path

def run_deletion_script():
    """
    Conecta ao MongoDB, encontra e exclui os dois planejamentos mais recentes
    após a confirmação do usuário.
    """
    # Garante que o script encontre o arquivo .env na raiz do projeto
    try:
        env_path = Path(__file__).resolve().parents[1] / '.env'
        load_dotenv(dotenv_path=env_path)
        print("Arquivo .env carregado com sucesso.")
    except Exception as e:
        print(f"Aviso: Não foi possível carregar o arquivo .env. Verifique o caminho. Erro: {e}")

    # Conexão com o MongoDB
    MONGO_URI = os.getenv("MONGO_URI")
    if not MONGO_URI:
        print("\nERRO: A variável de ambiente MONGO_URI não está definida no arquivo .env.")
        print("Certifique-se de que o arquivo .env está na raiz do projeto 'd:\\planejamento 0.79\\'.")
        return

    try:
        client = MongoClient(MONGO_URI)
        db = client.planejamento_db
        programacao_results_collection = db.programacao_results
        print("Conexão com o MongoDB estabelecida.")
    except Exception as e:
        print(f"ERRO: Falha ao conectar ao MongoDB: {e}")
        return

    # Encontrar os 2 documentos mais recentes
    try:
        cursor = programacao_results_collection.find().sort("timestamp", DESCENDING).limit(1)
        docs_para_excluir = list(cursor)

        if not docs_para_excluir:
            print("Nenhum planejamento encontrado no banco de dados.")
            return

        print("\nOs seguintes planejamentos serão excluídos:")
        ids_para_excluir = []
        for doc in docs_para_excluir:
            ids_para_excluir.append(doc['_id'])
            print(f"  - ID: {doc['_id']}, Data: {doc.get('timestamp')}, Descrição: {doc.get('descricao', 'N/A')}")

        # Pedir confirmação
        confirmacao = input("\nTem certeza que deseja excluir estes registros permanentemente? (s/n): ").lower()
        if confirmacao == 's':
            resultado = programacao_results_collection.delete_many({'_id': {'$in': ids_para_excluir}})
            print(f"\nSucesso! {resultado.deleted_count} registros foram excluídos.")
        else:
            print("\nOperação cancelada. Nenhum registro foi excluído.")

    except Exception as e:
        print(f"Ocorreu um erro durante a operação: {e}")

if __name__ == "__main__":
    run_deletion_script()
