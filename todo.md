## Melhorias a serem implementadas:

### Reestruturação da Interface Gráfica (Frontend):
- [ ] Criar um painel de controle (Dashboard) como nova página inicial.
- [ ] Implementar navegação lateral (sidebar) com as seguintes seções:
  - [ ] Visão Geral (Dashboard)
  - [ ] Planejamento (Processo Guiado em 3 passos)
    - [ ] Passo 1: Carregar Dados (Upload de planilhas)
    - [ ] Passo 2: Definir Parâmetros
    - [ ] Passo 3: Executar e Analisar Resultados (com abas para Resumo, Gantt, Detalhes, Gráficos, Pontos de Atenção)
  - [ ] Análise Histórica
  - [ ] Relatórios

### Novas Funcionalidades (Backend e Frontend):
- [ ] Gráfico de Gantt para Ocupação do Molde na Timeline.
- [ ] Gráfico de Gantt para Previsão de Conclusão de Pedidos.
- [ ] Comparação de Datas Finais de Pedidos entre Cargas (Análise de Atrasos).
- [ ] Simulação de Cenários ("What-If").
- [ ] Otimização Baseada em Tempo de Setup (Troca de Moldes).
- [ ] Calendário de Manutenção e Paradas Programadas.
- [ ] Alertas e Notificações Inteligentes.

### Melhorias de Qualidade e Arquitetura:
- [x] Validação de arquivos de upload com feedback visual claro.
- [x] População dinâmica do dropdown "Braço Selecionado".
- [x] Filtros e busca na tabela `programacao_final_df`.
- [x] Exportação de gráficos e tabelas em PDF consolidado.
- [ ] Persistência de dados de manutenção e paradas programadas no MongoDB.

### Análise Completa:
- [x] Análise da estrutura atual da aplicação
- [x] Identificação de pontos de melhoria
- [x] Leitura completa do código backend e frontend
- [x] Compreensão da lógica de negócio (Linear vs Otimizado)

### Implementação das Melhorias:
- [ ] Criar nova estrutura de interface com navegação lateral
- [ ] Implementar dashboard com KPIs e resumos
- [ ] Adicionar gráficos de Gantt para ocupação de moldes
- [ ] Adicionar gráficos de Gantt para conclusão de pedidos
- [ ] Implementar comparação entre programações
- [ ] Adicionar simulação de cenários
- [ ] Implementar alertas inteligentes


