document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let dadosOriginais = null;

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        loadDashboardData(); // Carrega KPIs e histórico recente

        // Check for hash in URL to show a specific section
        const hash = window.location.hash.substring(1);
        if (hash) {
            showSection(hash);
            const activeItem = document.querySelector(`.nav-item[data-section="${hash}"]`);
            if (activeItem) {
                updateActiveNavItem(activeItem);
            }
        }
    }

    function setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const href = item.getAttribute('href');
                // Se o link for para uma página diferente, deixa a navegação padrão ocorrer.
                // Se for um link de âncora (#) na mesma página, previne o padrão e usa o showSection.
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const section = item.dataset.section;
                    showSection(section);
                    updateActiveNavItem(item);
                }
            });
        });

        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

        // Consulta Pedido
        document.getElementById('pedido-search-btn').addEventListener('click', consultarPedido);

        // Enviar para Sankhya
    }

    function showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show selected section
        document.getElementById(`${sectionName}-section`).classList.remove('hidden');

    }

    function updateActiveNavItem(activeItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
    }

    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        const toggleIcon = document.querySelector('#sidebar-toggle i');

        // Alterna a classe que aplica a transformação para esconder/mostrar a sidebar
        sidebar.classList.toggle('sidebar-collapsed');

        // Alterna as classes de margem do conteúdo principal para que ele ocupe o espaço
        if (sidebar.classList.contains('sidebar-collapsed')) {
            mainContent.classList.remove('ml-64');
            mainContent.classList.add('ml-0');
            toggleIcon.classList.remove('fa-chevron-left');
            toggleIcon.classList.add('fa-chevron-right');
        } else {
            mainContent.classList.remove('ml-0');
            mainContent.classList.add('ml-64');
            toggleIcon.classList.remove('fa-chevron-right');
            toggleIcon.classList.add('fa-chevron-left');
        }
    }

    // Carrega os dados principais do dashboard (KPIs e histórico)
    function loadDashboardData() {
        loadDashboardKPIs();
        loadComparisonGantt();
        loadHistoricoRecente();
    }

    // Carrega os KPIs buscando o último planejamento
    async function loadDashboardKPIs() {
        try {
            const response = await fetch('/api/gantt/obter_ultimo_planejamento');
            const result = await response.json();

            if (response.ok && result.ultimo_planejamento) {
                updateDashboardKPIs(result.ultimo_planejamento);
            } else {
                // Se não houver histórico, zera os KPIs
                updateDashboardKPIs({});
            }
        } catch (error) {
            console.error('Erro ao carregar KPIs do dashboard:', error);
            updateDashboardKPIs({}); // Zera em caso de erro
        }
    }

    async function loadComparisonGantt() {
        try {
            const response = await fetch('/api/gantt/gantt_comparacao_atrasos');
            const result = await response.json();

            const ganttContainer = document.getElementById('gantt-comparacao-atrasos');
            const tableContainer = document.getElementById('tabela-comparacao-atrasos');

            ganttContainer.innerHTML = ''; // Limpa a mensagem de "carregando"
            tableContainer.innerHTML = ''; // Limpa a tabela
            tableContainer.classList.add('hidden'); // Esconde por padrão

            if (response.ok) {
                if (result.gantt_data && result.gantt_data.length > 0) {
                    createComparisonGantt(result.gantt_data);
                } else {
                    ganttContainer.innerHTML = `<p class="text-gray-400">${result.message || 'Não há dados de atraso para exibir.'}</p>`;
                }

                if (result.table_data && result.table_data.length > 0) {
                    createComparisonTable(result.table_data);
                }
            } else {
                ganttContainer.innerHTML = `<p class="text-red-400">${result.error || 'Erro ao carregar dados de comparação.'}</p>`;
            }
        } catch (error) {
            console.error('Erro ao carregar Gantt de comparação:', error);
            document.getElementById('gantt-comparacao-atrasos').innerHTML = '<p class="text-red-400">Erro ao carregar análise de atrasos.</p>';
        }
    }

    function createComparisonTable(tableData) {
        const container = document.getElementById('tabela-comparacao-atrasos');
        container.innerHTML = ''; // Limpa conteúdo anterior

        const table = document.createElement('table');
        table.className = 'min-w-full text-sm text-left text-gray-300';

        table.innerHTML = `
            <thead class="text-xs text-gray-200 uppercase bg-gray-600">
                <tr>
                    <th class="px-4 py-3">Número do Pedido</th>
                    <th class="px-4 py-3">Nome do Cliente</th>
                    <th class="px-4 py-3">Dias de Atraso</th>
                </tr>
            </thead>
            <tbody>
                ${tableData.map(item => `
                    <tr class="border-b border-gray-700 hover:bg-gray-700">
                        <td class="px-4 py-2">${item.pedido}</td>
                        <td class="px-4 py-2">${item.cliente}</td>
                        <td class="px-4 py-2 text-red-400 font-semibold">${item.dias_atraso}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        container.appendChild(table);
        container.classList.remove('hidden');
    }

    function createComparisonGantt(ganttData) {
        if (ganttData.length > 0) {
            const gantt = new Gantt("#gantt-comparacao-atrasos", ganttData, {
                header_height: 50,
                column_width: 30,
                step: 24,
                view_modes: ['Day', 'Week', 'Month'],
                bar_height: 20,
                bar_corner_radius: 3,
                padding: 18,
                view_mode: 'Day',
                date_format: 'DD/MM/YYYY',
                custom_popup_html: (task) => `
                    <div class="p-2 bg-gray-800 text-white rounded-md shadow-lg">
                        <div class="font-bold">${task.name}</div>
                        <p>Início: ${new Date(task._start).toLocaleDateString('pt-BR')}</p>
                        <p>Fim: ${new Date(task._end).toLocaleDateString('pt-BR')}</p>
                    </div>`
            });

            // Adiciona um pequeno atraso para garantir que o SVG foi renderizado antes de manipular o scroll
            setTimeout(() => {
                // Encontra a data de início mais antiga para ajustar a posição inicial do scroll
                const startDates = ganttData.map(task => new Date(task.start));
                const earliestDate = new Date(Math.min.apply(null, startDates));

                // Rola o gráfico para a data mais antiga para evitar espaços em branco à esquerda
                const earliestDateString = formatDateForGantt(earliestDate);
                const earliestDateElement = gantt.$svg.querySelector(`.date-group text[data-date="${earliestDateString}"]`);

                if (earliestDateElement && gantt.$container) {
                    const earliest_x_pos = parseFloat(earliestDateElement.getAttribute('x'));
                    const column_width = gantt.options.column_width || 30;
                    // Alinha o início do gráfico com o início da coluna da data mais antiga.
                    gantt.$container.scrollLeft = earliest_x_pos - (column_width / 2);
                }
            }, 100);

            // Lógica para cabeçalho fixo
            const ganttContainer = document.querySelector('#gantt-comparacao-atrasos');
            const header = ganttContainer.querySelector('.grid-header');
            if (ganttContainer && header) {
                header.parentNode.appendChild(header);
                ganttContainer.addEventListener('scroll', () => {
                    header.setAttribute('transform', `translate(0, ${ganttContainer.scrollTop})`);
                });
            }
        }
    }

    async function loadHistoricoRecente() {
        try {
            const response = await fetch('/api/programacao/obter_historico');
            const result = await response.json();

            const container = document.getElementById('historico-recente');
            container.innerHTML = '';

            if (response.ok && result.historico && result.historico.length > 0) {
                const recent = result.historico.slice(0, 3);
                recent.forEach(item => {
                    const date = new Date(item.timestamp).toLocaleString('pt-BR');
                    const isSimulation = item.tipo === 'Simulação de Setup';
                    const description = item.descricao || (isSimulation ? 'Simulação de Setup' : `Braço: ${item.braco_selecionado || 'Todos'}`);

                    const div = document.createElement('div');
                    div.className = `flex justify-between items-center p-3 rounded-lg ${isSimulation ? 'bg-yellow-900 bg-opacity-30' : 'bg-gray-700'}`;
                    div.innerHTML = `
                        <div>
                            <span class="text-gray-300">${date}</span>
                            ${isSimulation
                            ? `<span class="ml-2 text-xs font-semibold bg-yellow-500 text-black px-2 py-0.5 rounded-full">Simulação</span>`
                            : ''
                        }
                            <p class="text-sm text-secondary">${description}</p>
                        </div>
                        <button class="text-accent hover:text-accent-dark" onclick="carregarProgramacaoHistorico('${item._id}')">
                            Ver
                        </button>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<p class="text-gray-400">Nenhum histórico encontrado</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar histórico recente:', error);
            document.getElementById('historico-recente').innerHTML = '<p class="text-red-400">Erro ao carregar histórico</p>';
        }
    }

    function updateDashboardKPIs(data) {
        const stockOrderIds = ["9999997", "9999998", "9999999"];

        // Card: Total de Pedidos
        const pedidos = data.programacao_data ? new Set(data.programacao_data.map(item => item.Pedido)).size : 0;
        document.getElementById('kpi-pedidos').textContent = pedidos.toLocaleString('pt-BR');

        // Card: Total de Itens para Pedidos (clientes)
        const customerItems = data.programacao_data ? data.programacao_data
            .filter(item => !stockOrderIds.includes(String(item.Pedido)))
            .reduce((sum, item) => sum + item["Quantidade Programada"], 0) : 0;
        document.getElementById('kpi-itens-pedidos').textContent = customerItems.toLocaleString('pt-BR');

        // Card: Itens para Estoque
        const stockItems = data.programacao_data ? data.programacao_data
            .filter(item => stockOrderIds.includes(String(item.Pedido)))
            .reduce((sum, item) => sum + item["Quantidade Programada"], 0) : 0;
        document.getElementById('kpi-itens-estoque').textContent = stockItems.toLocaleString('pt-BR');

        // Card: Produtos Sem Molde
        const semMolde = data.necessidade_sem_moldes_data
            ? data.necessidade_sem_moldes_data.filter(item => item["Qtd. Moldes Cadastrados"] > 0).length
            : 0;
        document.getElementById('kpi-criticos').textContent = semMolde.toLocaleString('pt-BR');

        // Card: Moldes Ociosos
        const ociosos = data.moldes_ociosos_data ? data.moldes_ociosos_data.length : 0;
        document.getElementById('kpi-ociosos').textContent = ociosos.toLocaleString('pt-BR');

        // Card: Taxa de Ocupação
        let taxaOcupacao = '-';
        if (data.programacao_data && data.moldes_ociosos_data && data.dias_programacao > 0) {
            const moldesUsados = new Set(data.programacao_data.map(item => item.Produto));
            const moldesOciosos = new Set(data.moldes_ociosos_data.map(item => item.Nome));
            const totalMoldes = new Set([...moldesUsados, ...moldesOciosos]).size;

            if (totalMoldes > 0) {
                const totalDiasDisponiveis = totalMoldes * data.dias_programacao;
                const diasDeUsoEfetivo = new Set(data.programacao_data.map(item => `${item.Produto}|${item['Data Prevista']}`)).size;

                if (totalDiasDisponiveis > 0) {
                    taxaOcupacao = ((diasDeUsoEfetivo / totalDiasDisponiveis) * 100).toFixed(1).replace('.', ',') + '%';
                }
            }
        }
        document.getElementById('kpi-ocupacao').textContent = taxaOcupacao;
    }

    async function fetchAndSetLatestPlanningData() {
        try {
            const response = await fetch('/api/gantt/obter_ultimo_planejamento');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Nenhum planejamento encontrado no histórico');
            }
            dadosOriginais = result.ultimo_planejamento;
            return true;
        } catch (error) {
            alert(`Erro ao buscar último planejamento: ${error.message}`);
            dadosOriginais = null; // Limpa os dados em caso de erro
            return false;
        }
    }

    function showLoading() {
        document.getElementById('loading-layer').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('loading-layer').classList.add('hidden');
    }

    // Global functions for onclick handlers
    window.showSection = showSection;
    window.carregarProgramacaoHistorico = async function (id) {
        // Redirect to the planning page with the ID of the history item to load
        window.location.href = `planejamento.html?load=${id}`;
    };

    window.excluirProgramacaoHistorico = async function (id) {
        if (!confirm('Tem certeza que deseja excluir esta programação? Esta ação não pode ser desfeita.')) {
            return;
        }

        showLoading();
        try {
            const response = await fetch(`/api/gantt/excluir_planejamento/${id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao excluir planejamento');
            }

            alert(result.message); // Exibe a mensagem de sucesso do backend

            // Recarrega os dados para refletir a exclusão
            // A função loadHistorico foi movida para analise-historica.js
            loadDashboardData(); // Atualiza KPIs, histórico recente e Gantt de comparação

        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            hideLoading();
        }
    };

    async function consultarPedido() {
        const pedidoId = document.getElementById('pedido-search-input').value.trim();
        const resultsContainer = document.getElementById('pedido-search-results-container');

        if (!pedidoId) {
            alert('Por favor, digite o número de um pedido.');
            return;
        }

        showLoading();
        resultsContainer.innerHTML = ''; // Clear previous results
        resultsContainer.classList.add('hidden');

        try {
            const response = await fetch(`/api/gantt/consultar_pedido/${pedidoId}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao consultar pedido.');
            }

            displayPedidoSearchResults(result);

        } catch (error) {
            resultsContainer.innerHTML = `<p class="text-red-400">${error.message}</p>`;
            resultsContainer.classList.remove('hidden');
        } finally {
            hideLoading();
        }
    }

    function displayPedidoSearchResults(data) {
        const resultsContainer = document.getElementById('pedido-search-results-container');
        const { pedido_id, data_finalizacao, itens, timestamp_planejamento } = data;

        const timestamp = new Date(timestamp_planejamento).toLocaleString('pt-BR');

        const itemsHtml = itens.map(item => `
            <tr class="border-b border-gray-700 hover:bg-gray-700">
                <td class="px-4 py-2">${item.produto}</td>
                <td class="px-4 py-2 text-center">${item.braco}</td>
                <td class="px-4 py-2 text-center">${item.rodada}</td>
                <td class="px-4 py-2 text-center">${item.data_prevista_item}</td>
                <td class="px-4 py-2 text-right">${(item.quantidade || 0).toLocaleString('pt-BR')}</td>
            </tr>
        `).join('');

        resultsContainer.innerHTML = `
            <div class="bg-gray-900 p-4 rounded-lg">
                <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
                    <div>
                        <h4 class="text-lg font-bold text-white">Pedido: ${pedido_id}</h4>
                        <p class="text-secondary text-sm">Dados do último planejamento de ${timestamp}</p>
                    </div>
                    <div class="mt-2 sm:mt-0 sm:text-right">
                        <p class="text-secondary">Previsão de Finalização:</p>
                        <p class="text-xl font-bold text-green-400">${data_finalizacao}</p>
                    </div>
                </div>
                
                <h5 class="text-md font-semibold text-gray-300 mb-2">Itens Programados:</h5>
                <div class="overflow-x-auto max-h-72">
                    <table class="min-w-full text-sm text-left text-gray-300">
                        <thead class="text-xs text-gray-200 uppercase bg-gray-600 sticky top-0">
                            <tr>
                                <th class="px-4 py-2">Produto</th>
                                <th class="px-4 py-2 text-center">Braço</th>
                                <th class="px-4 py-2 text-center">Rodada</th>
                                <th class="px-4 py-2 text-center">Data Prevista do Item</th>
                                <th class="px-4 py-2 text-right">Quantidade</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        resultsContainer.classList.remove('hidden');
    }

    async function loadMotivosOcorrencia() {
        // 1. Verifica se os dados já estão em cache
        if (motivosOcorrenciaCache) {
            renderMotivos(motivosOcorrenciaCache); // Renderiza a partir do cache
            return;
        }

        try {
            const response = await fetch('/api/gantt/motivos/listar');
            const result = await response.json();
            const tbody = document.getElementById('motivos-tabela-body');
            tbody.innerHTML = '';

            if (response.ok && result.motivos && result.motivos.length > 0) {
                motivosOcorrenciaCache = result.motivos; // 2. Salva os dados no cache
                renderMotivos(motivosOcorrenciaCache);
            } else {
                tbody.innerHTML = '<tr><td colspan="2" class="px-4 py-2 text-gray-400 text-center">Nenhum motivo cadastrado.</td></tr>';
            }
        } catch (error) {
            console.error('Erro ao carregar motivos:', error);
            document.getElementById('motivos-tabela-body').innerHTML = '<tr><td colspan="2" class="px-4 py-2 text-red-400 text-center">Erro ao carregar motivos.</td></tr>';
        }
    }

    function renderMotivos(motivos) {
        const tbody = document.getElementById('motivos-tabela-body');
        tbody.innerHTML = '';
        if (motivos && motivos.length > 0) {
            motivos.forEach(motivo => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td class="px-4 py-2">${motivo.motivo}</td>
                    <td class="px-4 py-2 text-right"><button class="text-red-500 hover:text-red-400" onclick="excluirMotivo('${motivo._id}')"><i class="fas fa-trash-alt"></i></button></td>
                `;
            });
        }
    }

    async function adicionarMotivo() {
        const input = document.getElementById('novo-motivo-input');
        const motivoText = input.value.trim();
        if (!motivoText) { alert('Por favor, digite um motivo.'); return; }
        try {
            const response = await fetch('/api/gantt/motivos/adicionar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: motivoText }) });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.error || 'Erro ao adicionar motivo'); }
            alert(result.message);
            input.value = '';
            motivosOcorrenciaCache = null; // Invalida o cache para forçar o recarregamento
            loadMotivosOcorrencia();
        } catch (error) { alert(`Erro: ${error.message}`); }
    }

    window.excluirMotivo = async function (id) {
        if (!confirm('Tem certeza que deseja excluir este motivo?')) { return; }
        try {
            const response = await fetch(`/api/gantt/motivos/excluir/${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.error || 'Erro ao excluir motivo'); }
            alert(result.message);
            motivosOcorrenciaCache = null; // Invalida o cache
            loadMotivosOcorrencia();
        } catch (error) { alert(`Erro: ${error.message}`); }
    };

    async function handleLoadLatestForProjecao() {
        showLoading();
        const success = await fetchAndSetLatestPlanningData();
        if (success) {
            // Os dados agora estão em `dadosOriginais`, atualiza os gráficos da projeção
            await loadProjecaoChart();
        }
        hideLoading();
    }

    async function loadProjecaoChart() {
        // Check if we have planning data loaded
        if (!dadosOriginais || !dadosOriginais._id) {
            const container = document.getElementById('projecao-chart-container');
            const valorContainer = document.getElementById('projecao-valor-chart-container');
            const itensContainer = document.getElementById('projecao-itens-chart-container');
            const detalhesContainer = document.getElementById('projecao-detalhes-container');
            // If a chart instance exists, destroy it to free up resources and prevent memory leaks
            if (projecaoChartInstance) {
                projecaoChartInstance.destroy();
                projecaoChartInstance = null;
            }
            if (projecaoValorChartInstance) {
                projecaoValorChartInstance.destroy();
                projecaoValorChartInstance = null;
            }
            if (projecaoItensChartInstance) {
                projecaoItensChartInstance.destroy();
                projecaoItensChartInstance = null;
            }
            const message = '<p class="text-secondary text-center">Carregue ou gere um planejamento para ver a projeção.</p>';
            container.innerHTML = message;
            valorContainer.innerHTML = message;
            itensContainer.innerHTML = message;
            detalhesContainer.classList.add('hidden');
            detalhesContainer.innerHTML = '';
            return;
        }

        const programacaoId = dadosOriginais._id;

        try {
            const response = await fetch('/api/gantt/projecao_finalizacao_pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ programacao_id: programacaoId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao carregar dados da projeção');
            }

            projecaoDetalhes = result.detalhes_por_dia || {};
            createProjecaoQuantidadeChart(result);
            createProjecaoItensChart(result);
            createProjecaoValorChart(result);

        } catch (error) {
            console.error('Erro ao carregar gráficos de projeção:', error);
            const container = document.getElementById('projecao-chart-container');
            const valorContainer = document.getElementById('projecao-valor-chart-container');
            const itensContainer = document.getElementById('projecao-itens-chart-container');
            const errorMessage = `<p class="text-red-400 text-center">Erro ao carregar dados: ${error.message}</p>`;
            container.innerHTML = errorMessage;
            valorContainer.innerHTML = errorMessage;
            itensContainer.innerHTML = errorMessage;
        }
    }

    function createProjecaoQuantidadeChart(data) {
        const container = document.getElementById('projecao-chart-container');
        let canvas = document.getElementById('graficoProjecaoPedidos');

        // If canvas doesn't exist, create it. This handles the case where the
        // "no data" message might have replaced the original canvas element.
        if (!canvas) {
            container.innerHTML = ''; // Clear any message inside
            canvas = document.createElement('canvas');
            canvas.id = 'graficoProjecaoPedidos';
            container.appendChild(canvas);
        }

        const ctx = canvas.getContext('2d');

        // Destroy the old chart instance if it exists
        if (projecaoChartInstance) {
            projecaoChartInstance.destroy();
        }

        projecaoChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Pedidos Finalizados',
                    data: data.data_quantidade,
                    borderColor: 'rgba(46, 204, 113, 1)', // Success color
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: 'rgba(46, 204, 113, 1)',
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        align: 'top',
                        color: 'white',
                        font: { weight: 'bold' },
                        formatter: (value) => (value > 0 ? value : '')
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: 'white', stepSize: 1 },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        title: { display: true, text: 'Nº de Pedidos', color: 'white' }
                    },
                    x: {
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        title: { display: true, text: 'Data de Finalização', color: 'white' }
                    }
                }
            }
        });
    }

    function createProjecaoItensChart(data) {
        const container = document.getElementById('projecao-itens-chart-container');
        let canvas = document.getElementById('graficoProjecaoItens');

        if (!canvas) {
            container.innerHTML = ''; // Clear any message inside
            canvas = document.createElement('canvas');
            canvas.id = 'graficoProjecaoItens';
            container.appendChild(canvas);
        }

        const ctx = canvas.getContext('2d');

        if (projecaoItensChartInstance) {
            projecaoItensChartInstance.destroy();
        }

        projecaoItensChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Itens Planejados',
                    data: data.data_itens,
                    borderColor: 'rgba(243, 156, 18, 1)', // Warning color (Orange)
                    backgroundColor: 'rgba(243, 156, 18, 0.2)',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: 'rgba(243, 156, 18, 1)',
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        align: 'top',
                        color: 'white',
                        font: { weight: 'bold' },
                        formatter: (value) => {
                            if (value > 1000) {
                                return (value / 1000).toFixed(1).replace('.', ',') + 'k';
                            }
                            return value > 0 ? value : '';
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'white',
                            callback: (value) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value)
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        title: { display: true, text: 'Nº de Itens', color: 'white' }
                    },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                }
            }
        });
    }

    function createProjecaoValorChart(data) {
        const container = document.getElementById('projecao-valor-chart-container');
        let canvas = document.getElementById('graficoProjecaoValor');

        if (!canvas) {
            container.innerHTML = '';
            canvas = document.createElement('canvas');
            canvas.id = 'graficoProjecaoValor';
            container.appendChild(canvas);
        }

        const ctx = canvas.getContext('2d');

        if (projecaoValorChartInstance) {
            projecaoValorChartInstance.destroy();
        }

        projecaoValorChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Valor Liberado (R$)',
                    data: data.data_valor,
                    backgroundColor: 'rgba(52, 152, 219, 0.7)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const chartElement = elements[0];
                        const index = chartElement.index;
                        const dataSelecionada = data.labels[index];

                        // Use the stored details
                        const detalhesDoDia = projecaoDetalhes[dataSelecionada];

                        if (detalhesDoDia) {
                            displayProjecaoDetalhes(dataSelecionada, detalhesDoDia);
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    },
                    datalabels: {
                        align: 'top',
                        color: 'white',
                        font: { weight: 'bold' },
                        formatter: (value) => {
                            if (value > 1000) {
                                return 'R$' + (value / 1000).toFixed(1).replace('.', ',') + 'k';
                            }
                            if (value > 0) {
                                return 'R$' + value.toFixed(0);
                            }
                            return '';
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'white',
                            callback: (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value)
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        title: { display: true, text: 'Valor (R$)', color: 'white' }
                    },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                }
            }
        });
    }

    function displayProjecaoDetalhes(data, detalhes) {
        const container = document.getElementById('projecao-detalhes-container');
        container.innerHTML = ''; // Clear previous content

        // Sort details by value, descending
        detalhes.sort((a, b) => b.valor - a.valor);

        const tableHtml = `
            <h3 class="text-xl font-semibold text-accent mb-4">Pedidos Finalizados em ${data}</h3>
            <div class="overflow-x-auto max-h-96">
                <table class="min-w-full text-sm text-left text-main">
                    <thead class="text-xs text-main uppercase bg-primary-light sticky top-0">
                        <tr>
                            <th class="px-4 py-3">Pedido</th>
                            <th class="px-4 py-3">Cliente</th>
                            <th class="px-4 py-3">Produto</th>
                            <th class="px-4 py-3 text-right">Valor (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${detalhes.map(item => `
                            <tr class="border-b border-gray-700 hover:bg-gray-800">
                                <td class="px-4 py-2">${item.pedido}</td>
                                <td class="px-4 py-2">${item.cliente}</td>
                                <td class="px-4 py-2">${item.produto}</td>
                                <td class="px-4 py-2 text-right font-mono">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHtml;
        container.classList.remove('hidden');
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async function handleLoadLatestForOtimizacao() {
        showLoading();
        const success = await fetchAndSetLatestPlanningData();
        if (success) {
            renderOtimizacaoSetupTable(dadosOriginais.programacao_data);
            document.getElementById('reset-simulation-btn').classList.remove('hidden');
            document.getElementById('save-simulation-btn').classList.remove('hidden');
            document.getElementById('simulation-mode-notice').classList.remove('hidden');
        }
        hideLoading();
    }

    function renderOtimizacaoSetupTable(programacaoData) {
        const container = document.getElementById('otimizacao-setup-container');
        const kpiContainer = document.getElementById('otimizacao-kpi-container');

        // Limpa o conteúdo anterior e define as classes do grid
        container.innerHTML = '';

        if (!programacaoData || programacaoData.length === 0) {
            // Se não houver dados, exibe uma única mensagem que ocupa todas as colunas
            container.innerHTML = '<p class="text-secondary text-center py-8 md:col-span-2">Não há dados de programação para exibir.</p>';
            // Esconde os KPIs
            kpiContainer.classList.add('hidden');
            return;
        }

        // Mostra os KPIs
        kpiContainer.classList.remove('hidden');

        // --- Cálculo para os KPIs ---
        // A lógica agora SOMA a quantidade de moldes, baseada na finalidade da PRIMEIRA rodada de produção de cada molde.
        const stockOrderIds = {
            min: "9999997",
            med: "9999998",
            max: "9999999"
        };
        const allStockIds = Object.values(stockOrderIds);

        // 1. Encontra a primeira rodada e o tipo de pedido para cada molde único.
        const firstUseByMold = {};
        programacaoData.forEach(item => {
            const mold = item.Produto;
            const round = item["Número da Rodada"];

            if (!firstUseByMold[mold] || round < firstUseByMold[mold].round) {
                firstUseByMold[mold] = {
                    round: round,
                    order: String(item.Pedido)
                };
            }
        });

        // 2. Itera sobre a programação e SOMA as quantidades de moldes que estão na sua primeira rodada de uso.
        let countPedidos = 0;
        let countEstoqueMin = 0;
        let countEstoqueMed = 0;
        let countEstoqueMax = 0;

        programacaoData.forEach(item => {
            const mold = item.Produto;
            const round = item["Número da Rodada"];
            const quantity = item["Quantidade de Moldes"] || 0;
            const firstUse = firstUseByMold[mold];

            // Processa apenas os itens que estão na primeira rodada de uso do seu respectivo molde.
            if (firstUse && round === firstUse.round) {
                if (firstUse.order === stockOrderIds.min) countEstoqueMin += quantity;
                else if (firstUse.order === stockOrderIds.med) countEstoqueMed += quantity;
                else if (firstUse.order === stockOrderIds.max) countEstoqueMax += quantity;
                else if (!allStockIds.includes(firstUse.order)) countPedidos += quantity;
            }
        });

        // Atualiza os cards
        document.getElementById('otimizacao-kpi-pedidos').textContent = countPedidos;
        document.getElementById('otimizacao-kpi-estoque-min').textContent = countEstoqueMin;
        document.getElementById('otimizacao-kpi-estoque-med').textContent = countEstoqueMed;
        document.getElementById('otimizacao-kpi-estoque-max').textContent = countEstoqueMax;

        const stockTypeMap = {
            "9999997": "Estoque Mínimo",
            "9999998": "Estoque Médio",
            "9999999": "Estoque Máximo"
        };

        // Agrupa os dados por Braço -> Molde
        const setupByArm = programacaoData.reduce((acc, item) => {
            const arm = item.Braço;
            const mold = item.Produto;
            const order = String(item.Pedido);
            const quantity = item["Quantidade de Moldes"]; // Pega a quantidade de moldes

            if (!acc[arm]) acc[arm] = {};
            if (!acc[arm][mold]) {
                // Inicializa o objeto para o molde
                acc[arm][mold] = {
                    producingFor: new Set(),
                    quantity: quantity // Armazena a quantidade na primeira vez que o molde é encontrado
                };
            }

            if (stockTypeMap[order]) {
                acc[arm][mold].producingFor.add(stockTypeMap[order]);
            } else {
                // Agrupa todos os pedidos de cliente sob uma única categoria para simplificar
                acc[arm][mold].producingFor.add(`Pedido Cliente`);
            }

            // Garante que a quantidade seja a do item atual (assumindo que é constante por molde/braço)
            acc[arm][mold].quantity = quantity;

            return acc;
        }, {});

        // Cria uma tabela para cada braço de 1 a 6
        for (let i = 1; i <= 6; i++) {
            const armCard = document.createElement('div');
            armCard.className = 'arm-card bg-primary-dark rounded-lg p-4 flex flex-col h-full shadow-lg';
            armCard.dataset.armId = i; // Data attribute for drop target

            const moldsInArm = setupByArm[i];

            // Calculate total molds for the current arm
            let totalMoldesNoBraco = 0;
            if (moldsInArm) {
                totalMoldesNoBraco = Object.values(moldsInArm).reduce((sum, moldData) => sum + (moldData.quantity || 0), 0);
            }
            let tableHtml = `
                <table class="min-w-full text-sm text-left text-main">
                    <thead class="text-xs text-main uppercase bg-gray-700">
                        <tr>
                            <th class="px-4 py-2">Molde (Produto)</th>
                            <th class="px-4 py-2 text-center">Qtd</th>
                            <th class="px-4 py-2">Produzindo Para</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            if (moldsInArm) {
                const sortedMolds = Object.keys(moldsInArm).sort();
                sortedMolds.forEach(mold => {
                    const moldData = moldsInArm[mold];
                    const producingForSet = moldData.producingFor;
                    const quantity = moldData.quantity;
                    const producingForArray = Array.from(producingForSet);

                    // Cria badges coloridos para cada tipo de produção, evitando duplicatas
                    const producingForBadges = [...new Set(producingForArray)].map(p => {
                        if (p.startsWith('Pedido')) {
                            return `<span class="inline-block bg-accent text-white text-xs font-semibold mr-1 mb-1 px-2 py-0.5 rounded-full">Pedido</span>`;
                        }
                        if (p === "Estoque Mínimo") {
                            return `<span class="inline-block bg-yellow-500 text-black text-xs font-semibold mr-1 mb-1 px-2 py-0.5 rounded-full">MIN</span>`;
                        }
                        if (p === "Estoque Médio") {
                            return `<span class="inline-block bg-green-500 text-white text-xs font-semibold mr-1 mb-1 px-2 py-0.5 rounded-full">MED</span>`;
                        }
                        if (p === "Estoque Máximo") {
                            return `<span class="inline-block bg-red-500 text-white text-xs font-semibold mr-1 mb-1 px-2 py-0.5 rounded-full">MAX</span>`;
                        }
                        return '';
                    }).join('');

                    const moldId = `mold-row-${i}-${mold.replace(/[^a-zA-Z0-9]/g, '-')}`;
                    tableHtml += `
                        <tr id="${moldId}" class="mold-row border-b border-gray-700" draggable="true">
                            <td class="px-4 py-2 font-semibold truncate" title="${mold}">${mold}</td>
                            <td class="px-4 py-2 text-center font-mono">${quantity}</td>
                            <td class="px-4 py-2 flex flex-wrap items-center">${producingForBadges}</td>
                        </tr>
                    `;
                });
            } else {
                tableHtml += '<tr><td colspan="3" class="px-4 py-8 text-center text-secondary italic">Braço Vazio</td></tr>';
            }

            tableHtml += '</tbody></table>';

            armCard.innerHTML = `
                <h4 class="text-lg font-bold text-accent mb-3 border-b border-gray-600 pb-2 flex items-baseline">
                    <span>Braço ${i}</span>
                    <span class="text-sm font-normal text-secondary ml-2">(${totalMoldesNoBraco} moldes)</span>
                </h4>
                <div class="overflow-y-auto flex-grow">${tableHtml}</div>
            `;
            container.appendChild(armCard);
        }

        // --- Add Drag and Drop Event Listeners ---
        const draggableRows = container.querySelectorAll('.mold-row');
        const dropZones = container.querySelectorAll('.arm-card');

        draggableRows.forEach(row => {
            row.addEventListener('dragstart', (e) => {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.id);
            });

            row.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
            });
        });

        dropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessary to allow dropping
                zone.classList.add('drag-over');
            });

            zone.addEventListener('dragleave', (e) => {
                zone.classList.remove('drag-over');
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');

                const id = e.dataTransfer.getData('text/plain');
                const draggableElement = document.getElementById(id);
                const dropzoneTbody = zone.querySelector('tbody');

                if (draggableElement && dropzoneTbody) {
                    // If the dropzone is empty, remove the "Braço Vazio" message first
                    const emptyMessageRow = dropzoneTbody.querySelector('td[colspan="3"]');
                    if (emptyMessageRow) {
                        emptyMessageRow.parentElement.remove();
                    }

                    dropzoneTbody.appendChild(draggableElement);
                }
            });
        });
    }

    async function openLoadSimulationModal() {
        const modal = document.getElementById('load-simulation-modal');
        const container = document.getElementById('simulation-list-container');
        container.innerHTML = '<p class="text-secondary text-center py-8">Carregando simulações salvas...</p>';
        modal.classList.remove('hidden');

        try {
            const response = await fetch('/api/gantt/listar_simulacoes');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao buscar simulações.');
            }

            if (result.simulacoes && result.simulacoes.length > 0) {
                container.innerHTML = ''; // Clear loading message
                result.simulacoes.forEach(sim => {
                    const date = new Date(sim.timestamp).toLocaleString('pt-BR');
                    const description = sim.descricao || 'Simulação sem descrição';

                    const div = document.createElement('div');
                    div.className = 'flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors';
                    div.innerHTML = `
                        <div>
                            <p class="font-semibold text-main">${description}</p>
                            <p class="text-sm text-secondary">${date}</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button class="bg-success hover:bg-success-dark text-white font-semibold py-1 px-3 rounded-lg text-sm flex items-center" onclick="loadSimulationIntoSandbox('${sim._id}')">
                                <i class="fas fa-download mr-2"></i>
                                Carregar
                            </button>
                            <button class="bg-error hover:bg-error-dark text-white font-semibold py-1 px-3 rounded-lg text-sm flex items-center" onclick="deleteSimulation('${sim._id}', this)">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<p class="text-secondary text-center py-8">Nenhuma simulação de setup foi salva ainda.</p>';
            }

        } catch (error) {
            container.innerHTML = `<p class="text-error text-center py-8">Erro: ${error.message}</p>`;
        }
    }

    window.loadSimulationIntoSandbox = async function (simulationId) {
        showLoading();
        const modal = document.getElementById('load-simulation-modal');
        try {
            const response = await fetch(`/api/gantt/obter_planejamento/${simulationId}`);
            const result = await response.json();

            if (!response.ok) { throw new Error(result.error || 'Simulação não encontrada'); }

            dadosOriginais = result;

            renderOtimizacaoSetupTable(result.programacao_data);

            document.getElementById('reset-simulation-btn').classList.remove('hidden');
            document.getElementById('save-simulation-btn').classList.remove('hidden');
            document.getElementById('simulation-mode-notice').classList.remove('hidden');

            modal.classList.add('hidden');

            showSection('otimizacao-setup');
            alert(`Simulação "${result.descricao || result._id}" carregada com sucesso!`);

        } catch (error) {
            alert(`Erro ao carregar simulação: ${error.message}`);
        } finally {
            hideLoading();
        }
    };

    window.deleteSimulation = async function (simulationId, buttonElement) {
        if (!confirm('Tem certeza que deseja excluir esta simulação? Esta ação não pode ser desfeita.')) {
            return;
        }

        showLoading();
        try {
            const response = await fetch(`/api/gantt/excluir_planejamento/${simulationId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao excluir simulação');
            }

            alert(result.message);

            // Remove o item da lista do modal visualmente
            const itemDiv = buttonElement.closest('.flex.items-center.justify-between');
            if (itemDiv) {
                itemDiv.remove();
            }

            // Recarrega as listas de histórico principais para refletir a exclusão
            // loadHistorico() foi movido para analise-historica.js
            loadHistoricoRecente();

        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            hideLoading();
        }
    };
});
