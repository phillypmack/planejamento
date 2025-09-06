document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let currentStep = 1;
    let setupFile = null;
    let faltasFile = null;
    let cadastroMoldesFile = null;
    let dadosOriginais = null;
    let selectedHistoryItems = [];
    let projecaoDetalhes = null;
    let projecaoValorChartInstance = null;
    let projecaoChartInstance = null;
    let projecaoItensChartInstance = null;
    // Pagination for programacao table
    let motivosOcorrenciaCache = null;
    let programacaoCurrentPage = 1;
    const programacaoRowsPerPage = 50;
    let programacaoFilteredData = [];

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        setDefaultStartDate();

        // Check for a query parameter to load a specific historical plan
        const urlParams = new URLSearchParams(window.location.search);
        const planToLoadId = urlParams.get('load');
        if (planToLoadId) {
            loadAndShowHistoricPlan(planToLoadId);
        }
    }

    async function loadAndShowHistoricPlan(id) {
        showLoading();
        try {
            const response = await fetch(`/api/gantt/obter_planejamento/${id}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Planejamento não encontrado');
            }

            dadosOriginais = result;

            goToStep(3);
            showResults(result);
            document.getElementById('results-tabs').classList.remove('hidden');
            document.getElementById('enviar-sankhya-btn').classList.remove('hidden');

        } catch (error) {
            alert(`Erro ao carregar planejamento do histórico: ${error.message}`);
        } finally {
            hideLoading();
        }
    }


    function setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

        // File uploads
        document.getElementById('setup-file').addEventListener('change', handleSetupFile);
        document.getElementById('faltas-file').addEventListener('change', handleFaltasFile);
        document.getElementById('cadastro-moldes-file').addEventListener('change', handleCadastroFile);

        // Step navigation
        document.getElementById('next-step-1').addEventListener('click', () => goToStep(2));
        document.getElementById('prev-step-2').addEventListener('click', () => goToStep(1));
        document.getElementById('next-step-2').addEventListener('click', () => goToStep(3));
        document.getElementById('prev-step-3').addEventListener('click', () => goToStep(2));

        // Generate planning
        document.getElementById('gerar-programacao-btn').addEventListener('click', gerarProgramacao);

        // Tab navigation
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                showTab(tab);
            });
        });

        // Search functionality
        document.getElementById('search-programacao').addEventListener('input', filterProgramacao);
        document.getElementById('export-programacao').addEventListener('click', exportProgramacaoToExcel);

        // Enviar para Sankhya
        document.getElementById('enviar-sankhya-btn').addEventListener('click', enviarParaSankhya);
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

    function handleSetupFile(e) {
        const file = e.target.files[0];
        const status = document.getElementById('setup-status');
        if (file) {
            setupFile = file;
            status.textContent = `Arquivo selecionado: ${file.name}`;
            status.className = 'mt-1 text-xs text-green-500';
        } else {
            // Se o usuário remover o arquivo, limpa a variável e o status
            setupFile = null;
            status.textContent = '';
        }
        checkStep1Completion();
    }

    function handleFaltasFile(e) {
        const file = e.target.files[0];
        const status = document.getElementById('faltas-status');
        if (file) {
            faltasFile = file;
            status.textContent = `Arquivo selecionado: ${file.name}`;
            status.className = 'mt-1 text-xs text-green-500';
        } else {
            // Se o usuário remover o arquivo, limpa a variável e o status
            faltasFile = null;
            status.textContent = '';
        }
        checkStep1Completion();
    }

    function handleCadastroFile(e) {
        cadastroMoldesFile = e.target.files[0];
        const status = document.getElementById('cadastro-status');
        if (cadastroMoldesFile) {
            status.textContent = `Arquivo selecionado: ${cadastroMoldesFile.name}`;
            status.className = 'mt-1 text-xs text-green-500';
        }
    }

    function checkStep1Completion() {
        const nextButton = document.getElementById('next-step-1');
        if (setupFile && faltasFile) {
            nextButton.disabled = false;
            nextButton.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            nextButton.disabled = true;
            nextButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    function goToStep(step) {
        // Hide all steps
        document.querySelectorAll('.step-content').forEach(content => {
            content.classList.add('hidden');
        });

        // Show selected step
        document.getElementById(`step-${step}`).classList.remove('hidden');

        // Update step indicators
        document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
            indicator.classList.remove('active', 'completed');
            if (index + 1 < step) {
                indicator.classList.add('completed');
            } else if (index + 1 === step) {
                indicator.classList.add('active');
            }
        });

        currentStep = step;
    }

    function setDefaultStartDate() {
        const dateInput = document.getElementById('data-inicio-planejamento');
        if (dateInput) {
            // Sets the default value to today in YYYY-MM-DD format
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    async function gerarProgramacao() {
        showLoading();

        try {
            // Upload files
            if (!await uploadFiles()) {
                hideLoading();
                return;
            }

            // Get configuration
            const config = {
                braco_selecionado: document.getElementById('braco-selecionado').value,
                dias_programacao: parseInt(document.getElementById('dias-programacao').value),
                modo_sequenciamento: 'Otimizado', // Hardcoded as requested
                data_inicio: document.getElementById('data-inicio-planejamento').value,
                priorizacao_pedidos: document.getElementById('priorizacao-pedidos').value.trim(),
                incluir_sabados: document.getElementById('incluir-sabados').checked,
                incluir_domingos: document.getElementById('incluir-domingos').checked
            };

            // Generate planning
            const response = await fetch('/api/programacao/gerar_programacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao gerar programação');
            }

            // Store results
            dadosOriginais = result;

            // Show results
            showResults(result);
            document.getElementById('results-tabs').classList.remove('hidden');
            document.getElementById('enviar-sankhya-btn').classList.remove('hidden');

        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    async function enviarParaSankhya() {
        if (!dadosOriginais || !dadosOriginais.programacao_data || dadosOriginais.programacao_data.length === 0) {
            alert('Não há dados de programação para enviar. Por favor, gere ou carregue um planejamento primeiro.');
            return;
        }

        if (!confirm('Tem certeza que deseja enviar este planejamento para o Sankhya?')) {
            return;
        }

        showLoading();

        try {
            const response = await fetch('/api/gantt/enviar_para_sankhya', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ programacao_data: dadosOriginais.programacao_data })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro desconhecido ao enviar para o Sankhya.');
            }

            alert(result.message); // Ex: "Planejamento enviado com sucesso para o Sankhya."
        } catch (error) {
            alert(`Erro ao enviar para o Sankhya: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    async function uploadFiles() {
        const uploads = [
            { file: setupFile, url: '/api/programacao/upload_setup', status: 'setup-status' },
            { file: faltasFile, url: '/api/programacao/upload_faltas', status: 'faltas-status' }
        ];

        if (cadastroMoldesFile) {
            uploads.push({ file: cadastroMoldesFile, url: '/api/programacao/upload_cadastro_moldes', status: 'cadastro-status' });
        }

        for (const upload of uploads) {
            if (!await uploadFile(upload.file, upload.url, upload.status)) {
                return false;
            }
        }
        return true;
    }

    async function uploadFile(file, url, statusId) {
        if (!file) return true;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            const statusElement = document.getElementById(statusId);

            if (!response.ok) {
                statusElement.textContent = `Erro: ${result.error}`;
                statusElement.className = 'mt-1 text-xs text-red-500';
                return false;
            }

            statusElement.textContent = result.message;
            statusElement.className = 'mt-1 text-xs text-green-500';
            return true;

        } catch (error) {
            const statusElement = document.getElementById(statusId);
            statusElement.textContent = `Erro de rede: ${error.message}`;
            statusElement.className = 'mt-1 text-xs text-red-500';
            return false;
        }
    }

    function showResults(data) {
        // Update summary cards
        updateSummaryCards(data);

        // Generate alerts
        generateAlerts(data);

        // Create charts
        createCharts(data);

        // Fill tables
        fillTables(data);

        // Clear previous Gantt charts to be recreated on tab click
        document.getElementById('gantt-moldes').innerHTML = '';
        document.getElementById('gantt-pedidos').innerHTML = '';
    }

    function updateSummaryCards(data) {
        const pedidos = data.programacao_data ? new Set(data.programacao_data.map(item => item.Pedido)).size : 0;
        const ociosos = data.moldes_ociosos_data ? data.moldes_ociosos_data.length : 0;
        const semMolde = data.necessidade_sem_moldes_data
            ? data.necessidade_sem_moldes_data.filter(item => item["Qtd. Moldes Cadastrados"] > 0).length
            : 0;

        // Cálculo da Taxa de Ocupação
        let taxaOcupacao = '0%';
        if (data.programacao_data && data.moldes_ociosos_data && data.dias_programacao > 0) {
            const moldesUsados = new Set(data.programacao_data.map(item => item.Produto));
            const moldesOciosos = new Set(data.moldes_ociosos_data.map(item => item.Nome));
            const totalMoldes = new Set([...moldesUsados, ...moldesOciosos]).size;

            if (totalMoldes > 0) {
                // Total de "molde-dias" disponíveis no período
                const totalDiasDisponiveis = totalMoldes * data.dias_programacao;

                // Total de "molde-dias" que foram efetivamente utilizados
                const diasDeUsoEfetivo = new Set(data.programacao_data.map(item => `${item.Produto}|${item['Data Prevista']}`)).size;

                if (totalDiasDisponiveis > 0) {
                    taxaOcupacao = ((diasDeUsoEfetivo / totalDiasDisponiveis) * 100).toFixed(1) + '%';
                }
            }
        }

        document.getElementById('resumo-pedidos').textContent = pedidos;
        document.getElementById('resumo-ociosos').textContent = ociosos;
        document.getElementById('resumo-sem-molde').textContent = semMolde;
        document.getElementById('resumo-ocupacao').textContent = taxaOcupacao;
    }

    function generateAlerts(data) {
        const alertsContainer = document.getElementById('alertas-lista');
        alertsContainer.innerHTML = '';

        const alerts = [];
        const stockOrderIds = ["9999997", "9999998", "9999999"];

        // Check for order and stock quantities
        if (data.programacao_data) {
            const customerOrdersData = data.programacao_data.filter(item =>
                !stockOrderIds.includes(String(item.Pedido))
            );
            const stockOrdersData = data.programacao_data.filter(item =>
                stockOrderIds.includes(String(item.Pedido))
            );

            // 1. "X pedidos foram programados"
            const uniqueCustomerOrdersCount = new Set(customerOrdersData.map(item => item.Pedido)).size;
            if (uniqueCustomerOrdersCount > 0) {
                alerts.push({
                    type: 'info',
                    icon: 'fa-shopping-cart',
                    message: `${uniqueCustomerOrdersCount.toLocaleString('pt-BR')} pedidos foram programados.`
                });
            }

            // 2. "X itens foram programados para pedidos"
            const totalItemsForCustomers = customerOrdersData.reduce((sum, item) => sum + item["Quantidade Programada"], 0);
            if (totalItemsForCustomers > 0) {
                alerts.push({
                    type: 'info',
                    icon: 'fa-box-open',
                    message: `${totalItemsForCustomers.toLocaleString('pt-BR')} itens foram programados para pedidos.`
                });
            }

            // 3. "X Itens foram programados para Estoque"
            const totalItemsForStock = stockOrdersData.reduce((sum, item) => sum + item["Quantidade Programada"], 0);
            if (totalItemsForStock > 0) {
                alerts.push({
                    type: 'info',
                    icon: 'fa-warehouse',
                    message: `${totalItemsForStock.toLocaleString('pt-BR')} Itens foram programados para Estoque.`
                });
            }
        }

        // Check for idle molds
        if (data.moldes_ociosos_data && data.moldes_ociosos_data.length > 0) {
            const idleMolds = data.moldes_ociosos_data.length;
            alerts.push({
                type: 'warning',
                icon: 'fa-exclamation-circle',
                message: `${idleMolds} moldes ficarão ociosos durante o período.`
            });
        }

        // Check for products without molds
        const necessidadeFiltrada = data.necessidade_sem_moldes_data
            ? data.necessidade_sem_moldes_data.filter(item => item["Qtd. Moldes Cadastrados"] > 0)
            : [];

        if (necessidadeFiltrada.length > 0) {
            const withoutMolds = necessidadeFiltrada.length;
            alerts.push({
                type: 'error',
                icon: 'fa-exclamation-triangle',
                message: `${withoutMolds} produtos precisam de moldes para atender a demanda.`
            });
        }

        // Render alerts
        alerts.forEach(alert => {
            const alertDiv = document.createElement('div');
            alertDiv.className = `p-3 rounded-lg mb-2 ${getAlertClass(alert.type)}`;
            alertDiv.innerHTML = `
                <div class="flex items-center">
                    <i class="fas ${alert.icon || getAlertIcon(alert.type)} mr-2"></i>
                    <span>${alert.message}</span>
                </div>
            `;
            alertsContainer.appendChild(alertDiv);
        });

        if (alerts.length === 0) {
            alertsContainer.innerHTML = '<p class="text-gray-400">Nenhum alerta encontrado.</p>';
        }
    }

    function getAlertClass(type) {
        switch (type) {
            case 'error': return 'bg-error text-white';
            case 'warning': return 'bg-warning text-gray-800';
            case 'info': return 'bg-accent text-white';
            default: return 'bg-primary-light text-white';
        }
    }

    function getAlertIcon(type) {
        switch (type) {
            case 'error': return 'fa-exclamation-triangle';
            case 'warning': return 'fa-exclamation-circle';
            case 'info': return 'fa-info-circle';
            default: return 'fa-info';
        }
    }

    function createCharts(data) {
        if (data.programacao_data) {
            createProductChart(data.programacao_data);
            createEvolutionChart(data.programacao_data);
            createBranchChart(data.programacao_data);
            createMoldChart(data.programacao_data);
        }
    }

    function createProductChart(data) {
        const ctx = document.getElementById('graficoProdutos').getContext('2d');

        const produtos = [...new Set(data.map(item => item.Produto))];
        const quantidades = produtos.map(produto =>
            data.filter(item => item.Produto === produto)
                .reduce((sum, item) => sum + item["Quantidade Programada"], 0)
        );

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: produtos,
                datasets: [{
                    label: 'Quantidade Programada',
                    data: quantidades, // Accent Color
                    backgroundColor: 'rgba(52, 152, 219, 0.7)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: 'white' } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    x: {
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    function createEvolutionChart(data) {
        const ctx = document.getElementById('graficoEvolucao').getContext('2d');

        // Destrói o gráfico anterior, se existir, para evitar sobreposição de tooltips e dados
        const existingChart = Chart.getChart(ctx);
        if (existingChart) {
            existingChart.destroy();
        }

        // Define os pedidos que são considerados para estoque (consistente com o resto da aplicação)
        const stockOrderIds = ["9999997", "9999998", "9999999"];

        // Ordena as datas corretamente (formato DD/MM/YYYY)
        const datas = [...new Set(data.map(item => item["Data Prevista"]))].sort((a, b) => {
            const partsA = a.split('/'); // [DD, MM, YYYY]
            const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]);
            const partsB = b.split('/'); // [DD, MM, YYYY]
            const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
            return dateA - dateB;
        });

        // Calcula a quantidade total por data
        const quantidadesTotais = datas.map(data_item =>
            data.filter(item => item["Data Prevista"] === data_item)
                .reduce((sum, item) => sum + item["Quantidade Programada"], 0)
        );

        // Calcula a quantidade apenas para pedidos de estoque
        const quantidadesEstoque = datas.map(data_item =>
            data.filter(item =>
                item["Data Prevista"] === data_item &&
                stockOrderIds.includes(String(item.Pedido))
            )
                .reduce((sum, item) => sum + item["Quantidade Programada"], 0)
        );

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: datas,
                datasets: [{
                    label: 'Quantidade Total',
                    data: quantidadesTotais, // Accent Color
                    borderColor: 'rgba(52, 152, 219, 1)',
                    backgroundColor: 'rgba(52, 152, 219, 0.2)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Quantidade para Estoque', // Success Color
                    data: quantidadesEstoque,
                    borderColor: 'rgba(46, 204, 113, 1)',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: 'white' } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    x: {
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    function createBranchChart(data) {
        const ctx = document.getElementById('graficoBracos').getContext('2d');

        const bracos = [...new Set(data.map(item => item.Braço))];
        const quantidades = bracos.map(braco =>
            data.filter(item => item.Braço === braco)
                .reduce((sum, item) => sum + item["Quantidade Programada"], 0)
        );

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: bracos.map(b => `Braço ${b}`),
                datasets: [{
                    data: quantidades,
                    backgroundColor: [
                        'rgba(52, 152, 219, 0.7)', // Blue
                        'rgba(46, 204, 113, 0.7)', // Green
                        'rgba(243, 156, 18, 0.7)', // Orange
                        'rgba(26, 188, 156, 0.7)', // Turquoise
                        'rgba(155, 89, 182, 0.7)', // Purple
                        'rgba(231, 76, 60, 0.7)'  // Red
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: 'white' } }
                }
            }
        });
    }

    function createMoldChart(data) {
        const ctx = document.getElementById('graficoMoldesPorBraco').getContext('2d');

        const bracos = [...new Set(data.map(item => item.Braço))];
        const moldes = bracos.map(braco => {
            const bracoData = data.filter(item => item.Braço === braco);
            return bracoData.reduce((sum, item) => sum + item["Quantidade de Moldes"], 0);
        });

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: bracos.map(b => `Braço ${b}`),
                datasets: [{
                    data: moldes,
                    backgroundColor: [
                        'rgba(52, 152, 219, 0.7)', // Blue
                        'rgba(46, 204, 113, 0.7)', // Green
                        'rgba(243, 156, 18, 0.7)', // Orange
                        'rgba(26, 188, 156, 0.7)', // Turquoise
                        'rgba(155, 89, 182, 0.7)', // Purple
                        'rgba(231, 76, 60, 0.7)'  // Red
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: 'white' } }
                }
            }
        });
    }

    function fillTables(data) {
        // Fill programming table
        if (data.programacao_data) {
            // Initialize filtered data with all data and render the first page
            programacaoFilteredData = [...data.programacao_data];
            programacaoCurrentPage = 1;
            renderProgramacaoPage(programacaoCurrentPage);
        } else {
            // Clear table and pagination if no data
            document.getElementById('programacao-table').querySelector('tbody').innerHTML = '<tr><td colspan="9" class="text-center p-4 text-secondary">Sem dados de programação.</td></tr>';
            document.getElementById('programacao-pagination').innerHTML = '';
        }
    }

    function createGanttCharts(data) {
        if (!data || !data.programacao_data) return;

        const ganttMoldesContainer = document.getElementById('gantt-moldes');
        if (ganttMoldesContainer && ganttMoldesContainer.innerHTML.trim() === '') {
            createMoldGantt(data.programacao_data);
        }

        const ganttPedidosContainer = document.getElementById('gantt-pedidos');
        if (ganttPedidosContainer && ganttPedidosContainer.innerHTML.trim() === '') {
            createOrderGantt(data.programacao_data);
        }
    }

    function createMoldGantt(data) {
        const ganttData = processDataForMoldGantt(data);
        const container = document.getElementById('gantt-moldes');
        container.innerHTML = ''; // Clear previous content

        if (ganttData.length > 0) {
            const gantt = new Gantt(container, ganttData, {
                header_height: 50,
                column_width: 30,
                step: 24,
                view_modes: ['Day', 'Week', 'Month'],
                bar_height: 20,
                bar_corner_radius: 3,
                padding: 18,
                view_mode: 'Week',
                date_format: 'DD/MM/YYYY',
                custom_popup_html: null
            });
            setupGanttHeader(gantt, container);
        } else {
            container.innerHTML = '<p class="text-secondary text-center py-8">Sem dados de ocupação de moldes.</p>';
        }
    }

    function createOrderGantt(data) {
        const ganttData = processDataForOrderGantt(data);
        const container = document.getElementById('gantt-pedidos');
        container.innerHTML = ''; // Clear previous content

        if (ganttData.length > 0) {
            const gantt = new Gantt(container, ganttData, {
                header_height: 50,
                column_width: 30,
                step: 24,
                view_modes: ['Day', 'Week', 'Month'],
                bar_height: 20,
                bar_corner_radius: 3,
                padding: 18,
                view_mode: 'Week',
                date_format: 'DD/MM/YYYY',
                custom_popup_html: null
            });
            setupGanttHeader(gantt, container);
        } else {
            container.innerHTML = '<p class="text-secondary text-center py-8">Sem dados de previsão de pedidos.</p>';
        }
    }

    function setupGanttHeader(gantt, container) {
        const header = container.querySelector('.grid-header');
        if (header) {
            header.parentNode.appendChild(header);
            container.addEventListener('scroll', () => {
                header.setAttribute('transform', `translate(0, ${container.scrollTop})`);
            });
        }
    }

    function processDataForMoldGantt(data) {
        const ganttTasks = [];
        const moldOccupation = {};

        data.forEach(item => {
            const key = `${item.Produto} (Braço ${item.Braço})`;
            const date = item["Data Prevista"];
            if (!date) return;

            if (!moldOccupation[key]) {
                moldOccupation[key] = new Set();
            }
            moldOccupation[key].add(date);
        });

        Object.keys(moldOccupation).forEach((key, index) => {
            let dates = Array.from(moldOccupation[key]);
            if (dates.length === 0) return;

            dates.sort((a, b) => new Date(convertDateFormat(a)) - new Date(convertDateFormat(b)));

            const startDate = convertDateFormat(dates[0]);
            const endDateObj = new Date(convertDateFormat(dates[dates.length - 1]));
            endDateObj.setDate(endDateObj.getDate() + 1);

            ganttTasks.push({
                id: `mold-${index}`,
                name: key,
                start: startDate,
                end: formatDateForGantt(endDateObj),
                progress: 100,
                custom_class: 'bar-order'
            });
        });

        return ganttTasks;
    }

    function processDataForOrderGantt(data) {
        const ganttTasks = [];
        const orderProgress = {};

        data.forEach(item => {
            const key = `${item.Pedido}-${item.Produto}`;
            const date = item["Data Prevista"];
            if (!date) return;

            if (!orderProgress[key]) {
                orderProgress[key] = { dates: new Set(), orderId: item.Pedido };
            }
            orderProgress[key].dates.add(date);
        });

        Object.keys(orderProgress).forEach((key, index) => {
            let dates = Array.from(orderProgress[key].dates);
            if (dates.length === 0) return;

            dates.sort((a, b) => new Date(convertDateFormat(a)) - new Date(convertDateFormat(b)));

            const startDate = convertDateFormat(dates[0]);
            const endDateObj = new Date(convertDateFormat(dates[dates.length - 1]));
            endDateObj.setDate(endDateObj.getDate() + 1);

            const orderId = orderProgress[key].orderId;
            const isStockOrder = ["9999997", "9999998", "9999999"].includes(String(orderId));
            const customClass = isStockOrder ? 'bar-stock' : 'bar-order';

            ganttTasks.push({
                id: `order-${index}`,
                name: `Pedido ${key}`,
                start: startDate,
                end: formatDateForGantt(endDateObj),
                progress: 100,
                custom_class: customClass
            });
        });

        return ganttTasks;
    }

    function formatDateForGantt(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function convertDateFormat(dateStr) {
        // Convert from DD/MM/YYYY to YYYY-MM-DD
        const parts = dateStr.split('/');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    function showTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        // Show selected tab content
        const targetTab = tabName === 'gantt-tab' ? 'gantt-tab-content' : `${tabName}-tab`;
        document.getElementById(targetTab).classList.remove('hidden');

        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Lazy load Gantt charts when their tab is clicked
        if (tabName === 'gantt-tab' && dadosOriginais) {
            // Use a timeout to ensure the container is visible and rendered before creating the chart
            setTimeout(() => createGanttCharts(dadosOriginais), 100);
        }
    }

    function filterProgramacao() {
        const searchTerm = document.getElementById('search-programacao').value.toLowerCase();

        if (!dadosOriginais || !dadosOriginais.programacao_data) return;

        if (searchTerm.trim() === '') {
            programacaoFilteredData = [...dadosOriginais.programacao_data];
        } else {
            programacaoFilteredData = dadosOriginais.programacao_data.filter(item => {
                // Check against all relevant fields
                return Object.values(item).some(value =>
                    String(value).toLowerCase().includes(searchTerm)
                );
            });
        }

        // Reset to page 1 and re-render
        programacaoCurrentPage = 1;
        renderProgramacaoPage(programacaoCurrentPage);
    }

    function exportProgramacaoToExcel() {
        if (!programacaoFilteredData || programacaoFilteredData.length === 0) {
            alert('Não há dados para exportar. A tabela está vazia ou os filtros não retornaram resultados.');
            return;
        }

        // Create a new worksheet from the filtered data
        const worksheet = XLSX.utils.json_to_sheet(programacaoFilteredData);

        // Create a new workbook
        const workbook = XLSX.utils.book_new();

        // Append the worksheet to the workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Programação Detalhada');

        // Generate a timestamp for a unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `programacao_detalhada_${timestamp}.xlsx`;

        // Write the workbook and trigger the download
        XLSX.writeFile(workbook, filename);
    }

    function renderProgramacaoPage(page) {
        programacaoCurrentPage = page;
        const tableBody = document.getElementById('programacao-table').querySelector('tbody');
        tableBody.innerHTML = '';

        if (!programacaoFilteredData || programacaoFilteredData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-secondary">Nenhum resultado encontrado.</td></tr>';
            setupProgramacaoPagination(); // Update pagination to show 0 pages
            return;
        }

        const start = (page - 1) * programacaoRowsPerPage;
        const end = start + programacaoRowsPerPage;
        const paginatedItems = programacaoFilteredData.slice(start, end);

        paginatedItems.forEach(item => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td class="px-4 py-2">${item["Número da Rodada"]}</td>
                <td class="px-4 py-2">${item["Data Prevista"]}</td>
                <td class="px-4 py-2">${item.Braço}</td>
                <td class="px-4 py-2">${item.Produto}</td>
                <td class="px-4 py-2">${item.Cor}</td>
                <td class="px-4 py-2">${item.Pedido}</td>
                <td class="px-4 py-2">${item.CODPROD}</td>
                <td class="px-4 py-2">${item["Quantidade de Moldes"]}</td>
                <td class="px-4 py-2">${item["Quantidade Programada"]}</td>
            `;
        });

        setupProgramacaoPagination();
    }

    function setupProgramacaoPagination() {
        const paginationContainer = document.getElementById('programacao-pagination');
        paginationContainer.innerHTML = '';
        if (!programacaoFilteredData) return;
        const pageCount = Math.ceil(programacaoFilteredData.length / programacaoRowsPerPage);

        if (pageCount <= 1) return;

        const prevButton = document.createElement('button');
        prevButton.innerHTML = '<i class="fas fa-chevron-left mr-2"></i> Anterior';
        prevButton.className = 'bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed';
        prevButton.disabled = programacaoCurrentPage === 1;
        prevButton.addEventListener('click', () => renderProgramacaoPage(programacaoCurrentPage - 1));
        paginationContainer.appendChild(prevButton);

        const pageInfo = document.createElement('span');
        pageInfo.className = 'text-secondary';
        const totalItems = programacaoFilteredData.length;
        const startItem = (programacaoCurrentPage - 1) * programacaoRowsPerPage + 1;
        const endItem = Math.min(startItem + programacaoRowsPerPage - 1, totalItems);
        pageInfo.textContent = `Mostrando ${startItem}-${endItem} de ${totalItems} | Página ${programacaoCurrentPage} de ${pageCount}`;
        paginationContainer.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.innerHTML = 'Próximo <i class="fas fa-chevron-right ml-2"></i>';
        nextButton.className = 'bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed';
        nextButton.disabled = programacaoCurrentPage === pageCount;
        nextButton.addEventListener('click', () => renderProgramacaoPage(programacaoCurrentPage + 1));
        paginationContainer.appendChild(nextButton);
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

    async function carregarUltimoPlanejamento() {
        showLoading();
        const success = await fetchAndSetLatestPlanningData();
        if (success) {
            goToStep(3);

            showResults(dadosOriginais);
            document.getElementById('results-tabs').classList.remove('hidden');
            document.getElementById('enviar-sankhya-btn').classList.remove('hidden');
        }
        hideLoading();
    }

    function showLoading() {
        document.getElementById('loading-layer').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('loading-layer').classList.add('hidden');
    }

    // Global functions for onclick handlers
    window.carregarUltimoPlanejamento = carregarUltimoPlanejamento;
});