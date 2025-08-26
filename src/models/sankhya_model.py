from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class ProgramacaoItem(db.Model):
    __tablename__ = 'AD_PLAN'
    # __table_args__ = {'schema': 'SANKHYA'}  # Descomentado se necessário usar schema específico
    
    nuplan = db.Column('NUPLAN', db.Integer, primary_key=True)
    rodada = db.Column('RODADA', db.Integer, nullable=False)
    dtprev = db.Column('DTPREV', db.Date, nullable=False)
    braco = db.Column('BRACO', db.Integer, nullable=False)
    codprod = db.Column('CODPROD', db.Integer, nullable=False)
    descrprod = db.Column('DESCRPROD', db.String(255), nullable=False)
    cor = db.Column('COR', db.String(100))
    pedido = db.Column('PEDIDO', db.Integer)
    qtdmolde = db.Column('QTDMOLDE', db.Integer)
    qtdplan = db.Column('QTDPLAN', db.Integer, nullable=False)
    idiproc = db.Column('IDIPROC', db.Integer, nullable=True)
    dtinc = db.Column('DTINC', db.Date, nullable=False, default=datetime.now) # Nova coluna adicionada

    def __repr__(self):
        return f'<ProgramacaoItem {self.nuplan}>'

    def to_dict(self):
        return {
            'nuplan': self.nuplan,
            'rodada': self.rodada,
            'dtprev': self.dtprev.strftime('%d/%m/%Y') if self.dtprev else None,
            'braco': self.braco,
            'codprod': self.codprod,
            'descrprod': self.descrprod,
            'cor': self.cor,
            'pedido': self.pedido,
            'qtdmolde': self.qtdmolde,
            'qtdplan': self.qtdplan,
            'idiproc': self.idiproc,
            'dtinc': self.dtinc.strftime('%d/%m/%Y %H:%M:%S') if self.dtinc else None # Incluído para representação
        }

    @classmethod
    def from_programacao_data(cls, item_data, nuplan_counter):
        """
        Cria uma instância de ProgramacaoItem a partir dos dados de programação gerados
        """
        data_prevista = datetime.strptime(item_data['Data Prevista'], '%d/%m/%Y').date()
        
        return cls(
            nuplan=nuplan_counter,
            rodada=item_data['Número da Rodada'],
            dtprev=data_prevista,
            braco=item_data['Braço'],
            codprod=item_data['CODPROD'],
            descrprod=item_data['Produto'],
            cor=item_data['Cor'],
            pedido=item_data['Pedido'],
            qtdmolde=item_data['Quantidade de Moldes'],
            qtdplan=item_data['Quantidade Programada'],
            idiproc=None,
            dtinc=datetime.now() # Preenche com a data e hora atual do sistema
        )