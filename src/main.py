import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from dotenv import load_dotenv
from src.models.sankhya_model import db as sankhya_db
from src.routes.programacao_routes import programacao_bp # Nova importação
from src.routes.gantt_routes import gantt_bp # Importação das rotas Gantt

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

app.register_blueprint(programacao_bp)
app.register_blueprint(gantt_bp)

# Carrega variáveis de ambiente do arquivo .env na raiz do projeto
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)

# Configuração do Banco de Dados Sankhya (Oracle) com SQLAlchemy
SANKHYA_USER = os.getenv("SANKHYA_USER")
SANKHYA_PASSWORD = os.getenv("SANKHYA_PASSWORD")
SANKHYA_DSN = os.getenv("SANKHYA_DSN")

if all([SANKHYA_USER, SANKHYA_PASSWORD, SANKHYA_DSN]):
    app.config['SQLALCHEMY_DATABASE_URI'] = f"oracle+oracledb://{SANKHYA_USER}:{SANKHYA_PASSWORD}@{SANKHYA_DSN}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    sankhya_db.init_app(app)
else:
    print("AVISO: Variáveis de ambiente para o banco de dados Sankhya (Oracle) não estão configuradas. A funcionalidade de 'Enviar para Sankhya' não funcionará.")

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        # Servir a nova interface melhorada
        index_new_path = os.path.join(static_folder_path, 'index_new.html')
        if os.path.exists(index_new_path):
            return send_from_directory(static_folder_path, 'index_new.html')
        else:
            # Fallback para a interface original
            index_path = os.path.join(static_folder_path, 'index.html')
            if os.path.exists(index_path):
                return send_from_directory(static_folder_path, 'index.html')
            else:
                return "Sistema de Planejamento de Produção - Interface em desenvolvimento.", 200


if __name__ == '__main__':
    # Garante que o diretório de uploads temporários exista
    os.makedirs("/tmp/programacao_output", exist_ok=True)
    app.run(host='0.0.0.0', port=5000, debug=True)
