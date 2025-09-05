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
            dadosOriginais = null;
            return false;
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
        const success = await fetchAndSetLatestPlanningData();
        if (success) {
            await loadProjecaoChart();
        }
        hideLoading();
    }

    async function loadProjecaoChart() {
        if (!dadosOriginais || !dadosOriginais._id) {
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
});