# planejamento - Sistema de Programação de Produção

Este projeto é um sistema de API para programação de produção, desenvolvido em Flask, com capacidades de processamento de dados e integração com bancos de dados. Ele é conteinerizado usando Docker e Docker Compose para facilitar o desenvolvimento e a implantação.

## Funcionalidades

- **API de Programação de Produção**: Fornece endpoints para gerenciar e automatizar a programação de produção.
- **Serviço de Arquivos Estáticos**: Serve arquivos estáticos para uma interface web (o frontend está em desenvolvimento).
- **Processamento de Dados**: Utiliza bibliotecas como NumPy, Pandas e Openpyxl para manipulação e análise de dados, possivelmente envolvendo arquivos Excel.
- **Conectividade com Banco de Dados**: Preparado para conectar-se a bancos de dados MySQL e Oracle (a configuração atual está comentada, mas as dependências estão presentes).
- **Conteinerização**: Empacotado com Docker para garantir um ambiente de execução consistente e fácil implantação.

## Tecnologias Utilizadas

- **Backend**: Python, Flask, SQLAlchemy
- **Bancos de Dados**: PyMySQL, oracledb (drivers)
- **Processamento de Dados**: NumPy, Pandas, Openpyxl
- **Conteinerização**: Docker, Docker Compose

## Pré-requisitos

Para executar este projeto, você precisará ter o Docker e o Docker Compose instalados em sua máquina.

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Como Executar

Siga os passos abaixo para colocar o sistema em funcionamento:

1.  **Clone o Repositório**:
    ```bash
    git clone <URL_DO_SEU_REPOSITORIO>
    cd planejamento
    ```
    (Substitua `<URL_DO_SEU_REPOSITORIO>` pelo URL real do seu repositório Git.)

2.  **Construa e Inicie os Contêineres**:
    Certifique-se de que o Docker Daemon esteja em execução. No diretório raiz do projeto (onde o `docker-compose.yml` está localizado), execute o seguinte comando:
    ```bash
    docker-compose up --build
    ```
    Este comando construirá a imagem Docker da aplicação e iniciará o contêiner.

3.  **Acesse a Aplicação**:
    A aplicação estará disponível em `http://localhost:5000`.

    Se o frontend estiver em desenvolvimento, você verá uma mensagem indicando que a API está ativa.

## Estrutura do Projeto

-   `./`: Diretório raiz do projeto.
    -   `Dockerfile`: Define a imagem Docker da aplicação.
    -   `docker-compose.yml`: Configuração para executar a aplicação com Docker Compose.
    -   `requirements.txt`: Lista das dependências Python do projeto.
    -   `src/`: Contém o código-fonte da aplicação.
        -   `main.py`: Ponto de entrada principal da aplicação Flask.
        -   `data/`: Pode conter arquivos de dados, como o banco de dados SQLite (`programacao.db`).
        -   `models/`: Define os modelos de dados e a interação com o banco de dados.
        -   `routes/`: Contém os blueprints e as rotas da API (ex: `programacao_routes.py`).
        -   `static/`: Contém arquivos estáticos como HTML, CSS e JavaScript para o frontend.
        -   `templates/`: Pode conter templates HTML (embora `main.py` sirva arquivos estáticos diretamente).
