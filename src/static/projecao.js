document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let dadosOriginais = null;
    let projecaoDetalhes = null;
    let projecaoValorChartInstance = null;
    let projecaoChartInstance = null;
    let projecaoItensChartInstance = null;

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        handleLoadLatestForProjecao(); // Load data on page start
    }

    function setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

        // Projeção
        document.getElementById('load-latest-for-projecao-btn').addEventListener('click', handleLoadLatestForProjecao);

        // Event delegation for expandable rows in projection details
        const projecaoTableContainer = document.getElementById('projecao-detalhes-container');
        projecaoTableContainer.addEventListener('click', (e) => {
            const mainRow = e.target.closest('.main-row-projecao');
            if (mainRow) {
                const targetId = mainRow.dataset.targetId;
                const detailRow = document.getElementById(targetId);
                const icon = mainRow.querySelector('i.fas');

                detailRow.classList.toggle('hidden');
                mainRow.classList.toggle('bg-gray-800'); // Highlight class
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        });
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
        document.getElementById('loading-layer').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('loading-layer').classList.add('hidden');
    }

    async function handleLoadLatestForProjecao() {
        showLoading();
        try {
            const response = await fetch('/api/gantt/obter_ultimo_planejamento');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Nenhum planejamento encontrado no histórico');
            }
            dadosOriginais = result.ultimo_planejamento;
            await loadProjecaoChart();
        } catch (error) {
            alert(`Erro ao buscar último planejamento: ${error.message}`);
            dadosOriginais = null;
            loadProjecaoChart(); // Chama para limpar os gráficos e mostrar a mensagem de erro
        } finally {
            hideLoading();
        }
    }

    async function loadProjecaoChart() {
        const programacaoId = dadosOriginais ? dadosOriginais._id : null;

        if (!programacaoId) {
            const container = document.getElementById('projecao-chart-container');
            const valorContainer = document.getElementById('projecao-valor-chart-container');
            const itensContainer = document.getElementById('projecao-itens-chart-container');
            const detalhesContainer = document.getElementById('projecao-detalhes-container');

            if (projecaoChartInstance) projecaoChartInstance.destroy();
            if (projecaoValorChartInstance) projecaoValorChartInstance.destroy();
            if (projecaoItensChartInstance) projecaoItensChartInstance.destroy();

            const message = '<p class="text-secondary text-center py-8">Carregue ou gere um planejamento para ver a projeção.</p>';
            container.innerHTML = message;
            valorContainer.innerHTML = message;
            itensContainer.innerHTML = message;
            detalhesContainer.classList.add('hidden');
            detalhesContainer.innerHTML = '';
            return;
        }

        const cacheKey = `projecaoData_${programacaoId}`;
        const cachedData = sessionStorage.getItem(cacheKey);

        if (cachedData) {
            console.log("Carregando dados de projeção do cache da sessão.");
            const result = JSON.parse(cachedData);
            projecaoDetalhes = result.detalhes_por_dia || {};
            createProjecaoQuantidadeChart(result);
            createProjecaoItensChart(result);
            createProjecaoValorChart(result);
            return; // Finaliza a execução após carregar do cache
        }


        console.log("Buscando dados de projeção do servidor (não encontrado no cache).");
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

            // Salva os dados no cache da sessão para uso futuro
            sessionStorage.setItem(cacheKey, JSON.stringify(result));

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

        if (!canvas) {
            container.innerHTML = '';
            canvas = document.createElement('canvas');
            canvas.id = 'graficoProjecaoPedidos';
            container.appendChild(canvas);
        }

        const ctx = canvas.getContext('2d');
        if (projecaoChartInstance) projecaoChartInstance.destroy();

        projecaoChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Pedidos Finalizados',
                    data: data.data_quantidade,
                    borderColor: 'rgba(46, 204, 113, 1)',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    tension: 0.3, fill: true, pointBackgroundColor: 'rgba(46, 204, 113, 1)', pointRadius: 5, pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, datalabels: { align: 'top', color: 'white', font: { weight: 'bold' }, formatter: (value) => (value > 0 ? value : '') } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'white', stepSize: 1 }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, title: { display: true, text: 'Nº de Pedidos', color: 'white' } },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, title: { display: true, text: 'Data de Finalização', color: 'white' } }
                }
            }
        });
    }

    function createProjecaoItensChart(data) {
        const container = document.getElementById('projecao-itens-chart-container');
        let canvas = document.getElementById('graficoProjecaoItens');

        if (!canvas) {
            container.innerHTML = '';
            canvas = document.createElement('canvas');
            canvas.id = 'graficoProjecaoItens';
            container.appendChild(canvas);
        }

        const ctx = canvas.getContext('2d');
        if (projecaoItensChartInstance) projecaoItensChartInstance.destroy();

        projecaoItensChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Itens Planejados',
                    data: data.data_itens,
                    borderColor: 'rgba(243, 156, 18, 1)',
                    backgroundColor: 'rgba(243, 156, 18, 0.2)',
                    tension: 0.3, fill: true, pointBackgroundColor: 'rgba(243, 156, 18, 1)', pointRadius: 5, pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { align: 'top', color: 'white', font: { weight: 'bold' }, formatter: (value) => (value > 1000 ? (value / 1000).toFixed(1).replace('.', ',') + 'k' : (value > 0 ? value : '')) }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'white', callback: (value) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value) }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, title: { display: true, text: 'Nº de Itens', color: 'white' } },
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
        if (projecaoValorChartInstance) projecaoValorChartInstance.destroy();

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
                responsive: true, maintainAspectRatio: false,
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const chartElement = elements[0];
                        const index = chartElement.index;
                        const dataSelecionada = data.labels[index];
                        const detalhesDoDia = projecaoDetalhes[dataSelecionada];
                        if (detalhesDoDia) {
                            displayProjecaoDetalhes(dataSelecionada, detalhesDoDia);
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (context) => `${context.dataset.label || ''}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y)}` } },
                    datalabels: {
                        align: 'top', color: 'white', font: { weight: 'bold' },
                        formatter: (value) => (value > 1000 ? 'R$' + (value / 1000).toFixed(1).replace('.', ',') + 'k' : (value > 0 ? 'R$' + value.toFixed(0) : ''))
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'white', callback: (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value) }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, title: { display: true, text: 'Valor (R$)', color: 'white' } },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                }
            }
        });
    }

    function displayProjecaoDetalhes(data, detalhes) {
        const container = document.getElementById('projecao-detalhes-container');
        container.innerHTML = '';

        // 1. Group items by pedido
        const pedidosAgrupados = detalhes.reduce((acc, item) => {
            const pedidoId = item.pedido;
            if (!acc[pedidoId]) {
                acc[pedidoId] = {
                    cliente: item.cliente,
                    valorPedido: item.valorPedido,
                    itens: []
                };
            }
            acc[pedidoId].itens.push(item);
            return acc;
        }, {});

        // 2. Convert to array and sort by order value
        const sortedPedidos = Object.entries(pedidosAgrupados)
            .map(([pedidoId, data]) => ({ pedidoId, ...data }))
            .sort((a, b) => b.valorPedido - a.valorPedido);

        // 3. Build HTML for each expandable row
        let tableBodyHtml = '';
        sortedPedidos.forEach(order => {
            const detailRowId = `details-projecao-for-pedido-${order.pedidoId}`;
            const mainRowHtml = `
                <tr class="main-row-projecao border-b border-gray-700 hover:bg-gray-800 cursor-pointer" data-target-id="${detailRowId}">
                    <td class="px-4 py-3 text-center text-secondary"><i class="fas fa-chevron-down transition-transform"></i></td>
                    <td class="px-4 py-3 font-semibold">${order.pedidoId}</td>
                    <td class="px-4 py-3">${order.cliente}</td>
                    <td class="px-4 py-3 text-right font-mono">${order.valorPedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>
            `;

            const detailRowHtml = `
                <tr id="${detailRowId}" class="detail-row hidden">
                    <td colspan="4" class="detail-row-cell-projecao">
                        <div class="p-4">
                            <table class="min-w-full text-xs">
                                <thead class="text-gray-400">
                                    <tr>
                                        <th class="px-3 py-2 text-left">Molde (Produto)</th>
                                        <th class="px-3 py-2 text-left">Cor</th>
                                        <th class="px-3 py-2 text-right">Braço</th>
                                        <th class="px-3 py-2 text-right">Rodada</th>
                                        <th class="px-3 py-2 text-right">Quantidade</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.itens.map(item => `
                                        <tr class="border-t border-gray-700">
                                            <td class="px-3 py-2">${item.produto}</td>
                                            <td class="px-3 py-2">${item.cor || '-'}</td>
                                            <td class="px-3 py-2 text-right font-mono">${item.braco || '-'}</td>
                                            <td class="px-3 py-2 text-right font-mono">${item.rodada}</td>
                                            <td class="px-3 py-2 text-right font-mono">${(item.quantidade || 0).toLocaleString('pt-BR')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            `;
            tableBodyHtml += mainRowHtml + detailRowHtml;
        });

        // 4. Sort items for the second table (by arm, then round)
        const sortedItens = [...detalhes].sort((a, b) => {
            const bracoA = parseInt(a.braco) || 0;
            const bracoB = parseInt(b.braco) || 0;
            const rodadaA = parseInt(a.rodada) || 0;
            const rodadaB = parseInt(b.rodada) || 0;

            if (bracoA < bracoB) return -1;
            if (bracoA > bracoB) return 1;
            if (rodadaA < rodadaB) return -1;
            if (rodadaA > rodadaB) return 1;
            return 0;
        });

        // 5. Build HTML for the second table body
        const itensTableBodyHtml = sortedItens.map(item => `
            <tr class="border-b border-gray-700 hover:bg-gray-800">
                <td class="px-4 py-2 text-center">${item.braco}</td>
                <td class="px-4 py-2 text-center">${item.rodada}</td>
                <td class="px-4 py-2">${item.produto}</td>
                <td class="px-4 py-2">${item.cor || '-'}</td>
                <td class="px-4 py-2 text-right font-mono">${(item.quantidade || 0).toLocaleString('pt-BR')}</td>
            </tr>
        `).join('');

        // 6. Build the full HTML for the second table
        const itensTableHtml = `
            <div class="mt-8">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold text-accent">Itens Finalizados em ${data}</h3>
                    <button id="export-projecao-itens-btn" class="bg-success hover:bg-success-dark text-white font-bold py-1 px-3 rounded-lg flex items-center text-sm">
                        <i class="fas fa-file-excel mr-2"></i>
                        Exportar para Excel
                    </button>
                </div>
                <div class="overflow-x-auto max-h-96">
                    <table class="min-w-full text-sm text-left text-main">
                        <thead class="text-xs text-main uppercase bg-primary-light sticky top-0">
                            <tr>
                                <th class="px-4 py-3 text-center">Braço</th>
                                <th class="px-4 py-3 text-center">Rodada</th>
                                <th class="px-4 py-3">Produto</th>
                                <th class="px-4 py-3">Cor</th>
                                <th class="px-4 py-3 text-right">Quantidade</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itensTableBodyHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const fullTableHtml = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-semibold text-accent">Pedidos Finalizados em ${data}</h3>
                <button id="export-projecao-detalhes-btn" class="bg-success hover:bg-success-dark text-white font-bold py-1 px-3 rounded-lg flex items-center text-sm">
                    <i class="fas fa-file-excel mr-2"></i>
                    Exportar para Excel
                </button>
            </div>
            <div class="overflow-x-auto max-h-96" id="projecao-detalhes-table-container">
                <table class="min-w-full text-sm text-left text-main">
                    <thead class="text-xs text-main uppercase bg-primary-light sticky top-0">
                        <tr>
                            <th class="px-4 py-3 w-12"></th>
                            <th class="px-4 py-3">Pedido</th>
                            <th class="px-4 py-3">Cliente</th>
                            <th class="px-4 py-3 text-right">Valor (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableBodyHtml}
                    </tbody>
                </table>
            </div>
            ${itensTableHtml}
        `;

        container.innerHTML = fullTableHtml;
        container.classList.remove('hidden');

        document.getElementById('export-projecao-detalhes-btn').addEventListener('click', () => {
            exportProjecaoDetalhesToExcel(data, sortedPedidos);
        });

        document.getElementById('export-projecao-itens-btn').addEventListener('click', () => {
            exportProjecaoItensToExcel(data, sortedItens);
        });

        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function exportProjecaoDetalhesToExcel(data, sortedPedidos) {
        const dataToExport = [];

        sortedPedidos.forEach(order => {
            if (order.itens && order.itens.length > 0) {
                order.itens.forEach(item => {
                    dataToExport.push({
                        'Pedido': order.pedidoId,
                        'Cliente': order.cliente,
                        'Valor do Pedido (R$)': order.valorPedido,
                        'Produto': item.produto,
                        'Cor': item.cor || '-',
                        'Braço': item.braco || '-',
                        'Rodada': item.rodada,
                        'Quantidade': item.quantidade || 0
                    });
                });
            } else {
                // In case an order has no items, we can still list it.
                dataToExport.push({
                    'Pedido': order.pedidoId,
                    'Cliente': order.cliente,
                    'Valor do Pedido (R$)': order.valorPedido,
                    'Produto': '-',
                    'Cor': '-',
                    'Braço': '-',
                    'Rodada': '-',
                    'Quantidade': 0
                });
            }
        });

        if (dataToExport.length === 0) {
            alert('Não há dados detalhados para exportar.');
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalhes Projeção');

        const filename = `projecao_detalhes_${data.replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(workbook, filename);
    }

    function exportProjecaoItensToExcel(data, sortedItens) {
        const dataToExport = sortedItens.map(item => ({
            'Braço': item.braco,
            'Rodada': item.rodada,
            'Produto': item.produto,
            'Cor': item.cor || '-',
            'Quantidade': item.quantidade || 0
        }));

        if (dataToExport.length === 0) {
            alert('Não há itens para exportar.');
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens Finalizados');

        // Generate a dynamic filename
        const filename = `projecao_itens_${data.replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(workbook, filename);
    }
});