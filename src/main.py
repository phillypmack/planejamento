import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from src.models.user import db # Mantido caso seja usado no futuro, mas não para este app
from src.routes.user import user_bp # Mantido caso seja usado no futuro, mas não para este app
from src.routes.programacao_routes import programacao_bp # Nova importação
from src.routes.gantt_routes import gantt_bp # Importação das rotas Gantt

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

# app.register_blueprint(user_bp, url_prefix='/api') # Comentado pois não será usado
app.register_blueprint(programacao_bp) # Registro do novo blueprint
app.register_blueprint(gantt_bp) # Registro das rotas Gantt

# uncomment if you need to use database
# app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USERNAME', 'root')}:{os.getenv('DB_PASSWORD', 'password')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '3306')}/{os.getenv('DB_NAME', 'mydb')}"
# app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# db.init_app(app)
# with app.app_context():
#     db.create_all()

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
