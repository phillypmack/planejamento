document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let dadosOriginais = null;
    const chartInstances = {}; // To hold chart instances and prevent memory leaks

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        loadAndRenderCharts(); // Load data on initial page load
    }

    function setupEventListeners() {
        document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
        document.getElementById('reload-data-btn').addEventListener('click', () => loadAndRenderCharts(true));
    }

    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        const toggleIcon = document.querySelector('#sidebar-toggle i');

        sidebar.classList.toggle('sidebar-collapsed');

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

    function showLoading() {
        document.getElementById('top-loading-bar').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('top-loading-bar').classList.add('hidden');
    }

    async function fetchAndSetLatestPlanningData(forceReload = false) {
        const cacheKey = 'analisesGraficasCache'; // Use a specific cache key
        if (!forceReload) {
            const cachedData = sessionStorage.getItem(cacheKey);
            if (cachedData) {
                console.log("Carregando dados de análise do cache da sessão.");
                // O cache agora contém apenas 'programacao_data', então reconstruímos o objeto necessário.
                dadosOriginais = { programacao_data: JSON.parse(cachedData) };
                return true;
            }
        }

        console.log("Buscando dados de análise do servidor.");
        try {
            const response = await fetch('/api/gantt/obter_ultimo_planejamento');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Nenhum planejamento encontrado no histórico');
            }
            dadosOriginais = result.ultimo_planejamento;

            try {
                // Salva apenas a parte necessária dos dados (programacao_data) para evitar estourar a cota.
                if (dadosOriginais && dadosOriginais.programacao_data) {
                    sessionStorage.setItem(cacheKey, JSON.stringify(dadosOriginais.programacao_data));
                }
            } catch (e) {
                console.warn("Não foi possível salvar os dados de análise no cache: " + e.name);
            }
            return true;
        } catch (error) {
            alert(`Erro ao buscar último planejamento: ${error.message}`);
            dadosOriginais = null;
            return false;
        }
    }

    async function loadAndRenderCharts(forceReload = false) {
        showLoading();
        if (forceReload) {
            sessionStorage.removeItem('analisesGraficasCache');
        }
        const success = await fetchAndSetLatestPlanningData(forceReload);
        if (success && dadosOriginais && dadosOriginais.programacao_data) {
            renderAllCharts(dadosOriginais.programacao_data);
        } else {
            const containers = ['grafico-evolucao-total-container', 'grafico-produtos-container', 'grafico-evolucao-container', 'grafico-moldes-braco-container', 'grafico-bracos-container'];
            containers.forEach(id => {
                const container = document.getElementById(id);
                if (container) {
                    container.innerHTML = '<p class="text-secondary text-center py-8">Nenhum dado de planejamento encontrado. Gere um novo na página de Planejamento.</p>';
                }
            });
        }
        hideLoading();
    }

    function renderAllCharts(programacaoData) {
        createTotalEvolutionChart(programacaoData);
        createProductChart(programacaoData);
        createEvolutionChart(programacaoData);
        createBranchChart(programacaoData);
        createMoldChart(programacaoData);
    }

    function destroyChart(chartId) {
        if (chartInstances[chartId]) {
            chartInstances[chartId].destroy();
            delete chartInstances[chartId];
        }
    }

    function createTotalEvolutionChart(data) {
        destroyChart('graficoEvolucaoTotal');
        const ctx = document.getElementById('graficoEvolucaoTotal').getContext('2d');
        const stockOrderIds = ["9999997", "9999998", "9999999"]; // Define os IDs dos pedidos de estoque

        const datas = [...new Set(data.map(item => item["Data Prevista"]))].sort((a, b) => {
            const partsA = a.split('/');
            const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]);
            const partsB = b.split('/');
            const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
            return dateA - dateB;
        });

        const quantidadesTotais = datas.map(d => data.filter(item => item["Data Prevista"] === d).reduce((sum, item) => sum + item["Quantidade Programada"], 0));
        // Calcula a quantidade de itens para estoque em cada data
        const quantidadesEstoque = datas.map(d => data.filter(item => item["Data Prevista"] === d && stockOrderIds.includes(String(item.Pedido))).reduce((sum, item) => sum + item["Quantidade Programada"], 0));

        chartInstances['graficoEvolucaoTotal'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: datas,
                datasets: [{
                    label: 'Quantidade Total Programada',
                    data: quantidadesTotais,
                    borderColor: 'rgba(46, 204, 113, 1)',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { align: 'top', color: 'white', font: { weight: 'bold' }, formatter: (value) => (value > 1000 ? (value / 1000).toFixed(1).replace('.', ',') + 'k' : (value > 0 ? value : '')) },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const index = context.dataIndex;
                                const total = context.parsed.y;
                                const estoque = quantidadesEstoque[index];
                                const percentualEstoque = total > 0 ? ((estoque / total) * 100).toFixed(1) : 0;

                                const labelTotal = `Total Programado: ${total.toLocaleString('pt-BR')}`;
                                const labelEstoque = `Para Estoque: ${percentualEstoque.replace('.', ',')}% (${estoque.toLocaleString('pt-BR')})`;

                                return [labelTotal, labelEstoque];
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                }
            }
        });
    }

    function createProductChart(data) {
        destroyChart('graficoProdutos');
        const ctx = document.getElementById('graficoProdutos').getContext('2d');

        const produtos = [...new Set(data.map(item => item.Produto))];
        const quantidades = produtos.map(produto =>
            data.filter(item => item.Produto === produto)
                .reduce((sum, item) => sum + item["Quantidade Programada"], 0)
        );

        chartInstances['graficoProdutos'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: produtos,
                datasets: [{
                    label: 'Quantidade Programada',
                    data: quantidades,
                    backgroundColor: 'rgba(52, 152, 219, 0.7)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                }
            }
        });
    }

    function createEvolutionChart(data) {
        destroyChart('graficoEvolucao');
        const ctx = document.getElementById('graficoEvolucao').getContext('2d');
        const stockOrderIds = ["9999997", "9999998", "9999999"];

        const datas = [...new Set(data.map(item => item["Data Prevista"]))].sort((a, b) => {
            const partsA = a.split('/');
            const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]);
            const partsB = b.split('/');
            const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
            return dateA - dateB;
        });

        const quantidadesPedido = datas.map(d => data.filter(item => item["Data Prevista"] === d && !stockOrderIds.includes(String(item.Pedido))).reduce((sum, item) => sum + item["Quantidade Programada"], 0));
        const quantidadesEstoque = datas.map(d => data.filter(item => item["Data Prevista"] === d && stockOrderIds.includes(String(item.Pedido))).reduce((sum, item) => sum + item["Quantidade Programada"], 0));

        chartInstances['graficoEvolucao'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: datas,
                datasets: [{
                    label: 'Quantidade para Pedido',
                    data: quantidadesPedido,
                    borderColor: 'rgba(241, 196, 15, 1)',
                    backgroundColor: 'rgba(241, 196, 15, 0.2)',
                    tension: 0.4, fill: true
                }, {
                    label: 'Quantidade para Estoque',
                    data: quantidadesEstoque,
                    borderColor: 'rgba(46, 204, 113, 1)',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    tension: 0.4, fill: true
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: 'white' } } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                }
            }
        });
    }

    function createBranchChart(data) {
        destroyChart('graficoBracos');
        const ctx = document.getElementById('graficoBracos').getContext('2d');

        const bracos = [...new Set(data.map(item => item.Braço))].sort((a, b) => a - b);
        const quantidades = bracos.map(braco =>
            data.filter(item => item.Braço === braco)
                .reduce((sum, item) => sum + item["Quantidade Programada"], 0)
        );

        chartInstances['graficoBracos'] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: bracos.map(b => `Braço ${b}`),
                datasets: [{
                    data: quantidades,
                    backgroundColor: ['rgba(52, 152, 219, 0.7)', 'rgba(46, 204, 113, 0.7)', 'rgba(243, 156, 18, 0.7)', 'rgba(26, 188, 156, 0.7)', 'rgba(155, 89, 182, 0.7)', 'rgba(231, 76, 60, 0.7)']
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { color: 'white' } } }
            }
        });
    }

    function createMoldChart(data) {
        destroyChart('graficoMoldesPorBraco');
        const ctx = document.getElementById('graficoMoldesPorBraco').getContext('2d');

        const bracos = [...new Set(data.map(item => item.Braço))].sort((a, b) => a - b);
        const moldes = bracos.map(braco => {
            const bracoData = data.filter(item => item.Braço === braco);
            // Agrupa por produto para contar moldes únicos por braço
            const moldesUnicos = bracoData.reduce((acc, item) => {
                if (!acc[item.Produto]) {
                    acc[item.Produto] = item["Quantidade de Moldes"];
                }
                return acc;
            }, {});
            return Object.values(moldesUnicos).reduce((sum, count) => sum + count, 0);
        });

        chartInstances['graficoMoldesPorBraco'] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: bracos.map(b => `Braço ${b}`),
                datasets: [{
                    data: moldes,
                    backgroundColor: ['rgba(52, 152, 219, 0.7)', 'rgba(46, 204, 113, 0.7)', 'rgba(243, 156, 18, 0.7)', 'rgba(26, 188, 156, 0.7)', 'rgba(155, 89, 182, 0.7)', 'rgba(231, 76, 60, 0.7)']
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { color: 'white' } } }
            }
        });
    }
});