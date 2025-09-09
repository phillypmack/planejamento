document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let dadosOriginais = null;
    const chartInstances = {}; // To hold chart instances and prevent memory leaks
    let selectedProduct = null; // To hold the currently selected product for filtering
    let selectedDate = null; // To hold the currently selected date for filtering

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        displayActivePlanBanner();
        initializeAIChat(); // Adiciona a inicialização do modal da IA
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
        // Utiliza a nova função compartilhada para buscar os dados corretos
        dadosOriginais = await fetchActivePlanningData(forceReload);
        return dadosOriginais !== null;
    }

    async function loadAndRenderCharts(forceReload = false) {
        showLoading();
        selectedDate = null; // Reset date filter on any data reload
        selectedProduct = null; // Reset filter on any data reload
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
        createProductChart(programacaoData); // Will use global state
        createEvolutionChart(programacaoData); // Will use global state
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
                            },
                            footer: function (tooltipItems) {
                                return 'Fonte %: (Qtd. Estoque / Qtd. Total)';
                            },
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

    function createProductChart(fullData) {
        destroyChart('graficoProdutos');
        const container = document.getElementById('grafico-produtos-container');
        const canvas = document.getElementById('graficoProdutos');
        const ctx = canvas.getContext('2d');

        // Filter data if a date is selected
        const dataForChart = selectedDate ? fullData.filter(item => item["Data Prevista"] === selectedDate) : fullData;

        // Update chart title
        const titleElement = container.previousElementSibling.querySelector('.chart-title-text');
        if (titleElement) {
            titleElement.textContent = selectedDate
                ? `Itens planejados para: ${selectedDate}`
                : 'Quantidade de itens planejados';
        }

        // Aggregate and sort data
        const productQuantities = dataForChart.reduce((acc, item) => {
            const product = item.Produto;
            const quantity = item["Quantidade Programada"];
            acc[product] = (acc[product] || 0) + quantity;
            return acc;
        }, {});

        const sortedProducts = Object.entries(productQuantities)
            .map(([produto, quantidade]) => ({ produto, quantidade }))
            .sort((a, b) => b.quantidade - a.quantidade); // Sort descending for horizontal chart

        const produtos = sortedProducts.map(d => d.produto);
        const quantidades = sortedProducts.map(d => d.quantidade);

        // Dynamic Height Calculation
        const barHeight = 25; // pixels per bar
        const chartPadding = 80; // pixels for top/bottom padding and axes
        container.style.height = `${Math.max(400, (produtos.length * barHeight) + chartPadding)}px`;

        // Highlight the selected product
        const backgroundColors = produtos.map(p =>
            p === selectedProduct && !selectedDate ? 'rgba(241, 196, 15, 0.9)' : 'rgba(52, 152, 219, 0.7)' // Only highlight if not in date-filter mode
        );
        const borderColors = produtos.map(p =>
            p === selectedProduct && !selectedDate ? 'rgba(241, 196, 15, 1)' : 'rgba(52, 152, 219, 1)'
        );

        chartInstances['graficoProdutos'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: produtos,
                datasets: [{
                    label: 'Quantidade Programada',
                    data: quantidades,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Make it horizontal
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const clickedIndex = elements[0].index;
                        const clickedProduct = produtos[clickedIndex];

                        // Toggle selection: if same product is clicked, deselect. Otherwise, select new one.
                        // When a product is selected, clear the date filter.
                        selectedProduct = (selectedProduct === clickedProduct) ? null : clickedProduct;
                        selectedDate = null;

                        // Re-render this chart to update colors and the evolution chart to filter data
                        createProductChart(fullData); // Will use the new selectedProduct state
                        createEvolutionChart(fullData); // Will use the new selectedProduct state
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                }
            }
        });
    }

    function createEvolutionChart(data) { // The function now implicitly uses selectedProduct
        destroyChart('graficoEvolucao');
        const ctx = document.getElementById('graficoEvolucao').getContext('2d');
        const stockOrderIds = ["9999997", "9999998", "9999999"];

        // Filter data if a product is selected
        const filteredData = selectedProduct ? data.filter(item => item.Produto === selectedProduct) : data;

        // Update chart title to reflect the filter
        const titleElement = document.querySelector('#grafico-evolucao-container').previousElementSibling.querySelector('.chart-title-text');
        if (titleElement) {
            titleElement.textContent = selectedProduct
                ? `Evolução por tipo para: ${selectedProduct}`
                : 'Evolução por tipo';
        }

        const datas = [...new Set(filteredData.map(item => item["Data Prevista"]))].sort((a, b) => {
            const partsA = a.split('/');
            const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]);
            const partsB = b.split('/');
            const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
            return dateA - dateB;
        });

        const quantidadesPedido = datas.map(d => filteredData.filter(item => item["Data Prevista"] === d && !stockOrderIds.includes(String(item.Pedido))).reduce((sum, item) => sum + item["Quantidade Programada"], 0));
        const quantidadesEstoque = datas.map(d => filteredData.filter(item => item["Data Prevista"] === d && stockOrderIds.includes(String(item.Pedido))).reduce((sum, item) => sum + item["Quantidade Programada"], 0));

        // Lógica de destaque para o ponto selecionado
        const pointRadii = datas.map(d => d === selectedDate ? 7 : 3);
        const pointBorderWidths = datas.map(d => d === selectedDate ? 3 : 1);
        const pointBorderColorsPedido = datas.map(d => d === selectedDate ? 'rgba(255, 255, 255, 1)' : 'rgba(241, 196, 15, 1)');
        const pointBorderColorsEstoque = datas.map(d => d === selectedDate ? 'rgba(255, 255, 255, 1)' : 'rgba(46, 204, 113, 1)');

        chartInstances['graficoEvolucao'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: datas,
                datasets: [{
                    label: 'Quantidade para Pedido',
                    data: quantidadesPedido,
                    borderColor: 'rgba(241, 196, 15, 1)',
                    backgroundColor: 'rgba(241, 196, 15, 0.2)',
                    tension: 0.4, fill: true,
                    pointRadius: pointRadii,
                    pointBorderWidth: pointBorderWidths,
                    pointBorderColor: pointBorderColorsPedido,
                    pointHoverRadius: 8
                }, {
                    label: 'Quantidade para Estoque',
                    data: quantidadesEstoque,
                    borderColor: 'rgba(46, 204, 113, 1)',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    tension: 0.4, fill: true,
                    pointRadius: pointRadii,
                    pointBorderWidth: pointBorderWidths,
                    pointBorderColor: pointBorderColorsEstoque,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const clickedIndex = elements[0].index;
                        const clickedDate = datas[clickedIndex];

                        // Toggle date selection and clear product selection
                        selectedDate = (selectedDate === clickedDate) ? null : clickedDate;
                        selectedProduct = null;

                        // Re-render both charts with the new state
                        createProductChart(data);
                        createEvolutionChart(data);
                    }
                },
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