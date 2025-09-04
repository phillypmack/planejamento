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
        loadDashboardData(); // Carrega KPIs e histórico recente
        loadHistorico();
        setDefaultStartDate();
    }

    function setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                showSection(section);
                updateActiveNavItem(item);
            });
        });

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

        // Compare history
        document.getElementById('comparar-btn').addEventListener('click', compararProgramacoes);

        // Cadastros
        document.getElementById('adicionar-motivo-btn').addEventListener('click', adicionarMotivo);

        // Relatórios
        document.getElementById('gerar-pdf-btn').addEventListener('click', gerarRelatorioPDF);

        // Consulta Pedido
        document.getElementById('pedido-search-btn').addEventListener('click', consultarPedido);

        // Projeção
        document.getElementById('load-latest-for-projecao-btn').addEventListener('click', handleLoadLatestForProjecao);

        // Otimização de Setup
        document.getElementById('load-latest-for-otimizacao-btn').addEventListener('click', handleLoadLatestForOtimizacao);
        document.getElementById('reset-simulation-btn').addEventListener('click', handleResetOtimizacao);
        document.getElementById('save-simulation-btn').addEventListener('click', handleSaveSandbox);
        document.getElementById('load-simulation-btn').addEventListener('click', openLoadSimulationModal);
        document.getElementById('close-simulation-modal-btn').addEventListener('click', () => document.getElementById('load-simulation-modal').classList.add('hidden'));
        // Enviar para Sankhya
        document.getElementById('enviar-sankhya-btn').addEventListener('click', enviarParaSankhya);
    }

    function showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show selected section
        document.getElementById(`${sectionName}-section`).classList.remove('hidden');

        // Carrega dados específicos da seção quando ela é exibida
        if (sectionName === 'analise') {
            loadAtrasosHistorico();
        }
        if (sectionName === 'cadastros') {
            loadMotivosOcorrencia();
        }
        if (sectionName === 'relatorios') {
            loadHistoricoParaRelatorios();
        }
        if (sectionName === 'projecao') {
            loadProjecaoChart();
        }
        if (sectionName === 'otimizacao-setup') {
            // Renderiza a tabela se os dados já estiverem carregados
            if (dadosOriginais) renderOtimizacaoSetupTable(dadosOriginais.programacao_data);
        }
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

    function handleSetupFile(e) {
        setupFile = e.target.files[0];
        const status = document.getElementById('setup-status');
        if (setupFile) {
            status.textContent = `Arquivo selecionado: ${setupFile.name}`;
            status.className = 'mt-1 text-xs text-green-500';
        }
        checkStep1Completion();
    }

    function handleFaltasFile(e) {
        faltasFile = e.target.files[0];
        const status = document.getElementById('faltas-status');
        if (faltasFile) {
            status.textContent = `Arquivo selecionado: ${faltasFile.name}`;
            status.className = 'mt-1 text-xs text-green-500';
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

    function handleResetOtimizacao() {
        if (dadosOriginais && dadosOriginais.programacao_data) {
            if (confirm('Tem certeza que deseja resetar as alterações da simulação?')) {
                renderOtimizacaoSetupTable(dadosOriginais.programacao_data);
            }
        } else {
            alert('Não há dados originais para resetar. Carregue um planejamento primeiro.');
        }
    }

    async function handleSaveSandbox() {
        if (!dadosOriginais) {
            alert('Não há dados de simulação para salvar. Carregue um planejamento primeiro.');
            return;
        }

        const description = prompt("Digite um nome ou descrição para esta simulação de setup:", `Simulação de ${new Date().toLocaleString('pt-BR')}`);
        if (!description) {
            // User cancelled the prompt
            return;
        }

        showLoading();

        try {
            // 1. Create a map of the new mold locations from the DOM
            const newMoldLocations = {};
            const armCards = document.querySelectorAll('#otimizacao-setup-container .arm-card');
            armCards.forEach(card => {
                const armId = parseInt(card.dataset.armId, 10);
                const moldRows = card.querySelectorAll('.mold-row');
                moldRows.forEach(row => {
                    const moldName = row.querySelector('td:first-child').textContent.trim();
                    if (moldName) {
                        newMoldLocations[moldName] = armId;
                    }
                });
            });

            // 2. Create a deep copy of the original planning data to modify
            const novoPlanejamento = JSON.parse(JSON.stringify(dadosOriginais));

            // 3. Update the arm for each item in the programming data based on the new locations
            novoPlanejamento.programacao_data.forEach(item => {
                const currentMold = item.Produto;
                if (newMoldLocations.hasOwnProperty(currentMold)) {
                    item.Braço = newMoldLocations[currentMold];
                }
            });

            // 4. Update metadata for the new planning
            novoPlanejamento.timestamp = new Date().toISOString();
            novoPlanejamento.tipo = 'Simulação de Setup'; // Add a type to identify it
            novoPlanejamento.descricao = description; // Add the user-provided description
            delete novoPlanejamento._id; // Remove the old ID to allow MongoDB to create a new one

            // 5. Send to the backend to save
            const response = await fetch('/api/gantt/salvar_planejamento_alternativo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novoPlanejamento)
            });

            const result = await response.json();
            if (!response.ok) { throw new Error(result.error || 'Erro ao salvar a simulação.'); }

            alert(result.message);

            // Reload history to show the new saved simulation
            loadHistorico();
            loadHistoricoRecente();

        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            hideLoading();
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
                priorizacao_pedidos: document.getElementById('priorizacao-pedidos').value.trim()
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

            // Update dashboard
            updateDashboardKPIs(result);

            // Recarrega o histórico para exibir a nova entrada
            loadHistoricoRecente();
            loadHistorico();

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

        // Generate optimization suggestions
        generateOptimizationSuggestions(data);

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
            setupProgramacaoPagination();
        } else {
            // Clear table and pagination if no data
            document.getElementById('programacao-table').querySelector('tbody').innerHTML = '<tr><td colspan="9" class="text-center p-4 text-secondary">Sem dados de programação.</td></tr>';
            document.getElementById('programacao-pagination').innerHTML = '';
        }

        // Fill idle molds table
        const ociososTable = document.getElementById('ociosos-table').querySelector('tbody');
        ociososTable.innerHTML = '';

        if (data.moldes_ociosos_data) {
            data.moldes_ociosos_data.forEach(item => {
                const row = ociososTable.insertRow();
                row.innerHTML = `
                    <td class="px-4 py-2">${item.Nome}</td>
                    <td class="px-4 py-2">${item.Quantidade}</td>
                    <td class="px-4 py-2">${item["Rodada Ociosa"]}</td>
                    <td class="px-4 py-2">${item.Braço}</td>
                `;
            });
        }

        // Fill necessity table
        const necessidadeTable = document.getElementById('necessidade-table').querySelector('tbody');
        necessidadeTable.innerHTML = '';

        if (data.necessidade_sem_moldes_data) {
            const necessidadeFiltrada = data.necessidade_sem_moldes_data.filter(item => item["Qtd. Moldes Cadastrados"] > 0);

            // Agrupar por produto e somar quantidades
            const necessidadeAgrupada = necessidadeFiltrada.reduce((acc, item) => {
                const produtoNome = item.Produto || item.Nome;
                if (!acc[produtoNome]) {
                    acc[produtoNome] = {
                        Produto: produtoNome,
                        Quantidade: 0,
                        "Qtd. Moldes Cadastrados": item["Qtd. Moldes Cadastrados"]
                    };
                }
                acc[produtoNome].Quantidade += item.Quantidade;
                return acc;
            }, {});

            // Converter para array e ordenar
            const listaAgrupada = Object.values(necessidadeAgrupada);
            listaAgrupada.sort((a, b) => b.Quantidade - a.Quantidade);

            listaAgrupada.forEach(item => {
                const row = necessidadeTable.insertRow();
                row.innerHTML = `
                    <td class="px-4 py-2">${item.Produto}</td>
                    <td class="px-4 py-2">${item.Quantidade}</td>
                    <td class="px-4 py-2">${item["Qtd. Moldes Cadastrados"]}</td>
                `;
            });
        }

        // Fill stock production table
        const estoqueTable = document.getElementById('estoque-table').querySelector('tbody');
        estoqueTable.innerHTML = '';

        if (data.programacao_data) {
            const stockOrderIds = ["9999997", "9999998", "9999999"];
            const stockTypeMap = {
                "9999997": "ESTOQUE MINI",
                "9999998": "ESTOQUE MED",
                "9999999": "ESTOQUE MAX"
            };

            const stockProductionData = data.programacao_data.filter(item =>
                stockOrderIds.includes(String(item.Pedido))
            );

            if (stockProductionData.length > 0) {
                const groupedByProduct = stockProductionData.reduce((acc, item) => {
                    const produto = item.Produto;
                    const braco = item.Braço;
                    const moldes = item["Quantidade de Moldes"];

                    if (!acc[produto]) {
                        acc[produto] = {
                            totalQuantity: 0,
                            stockTypes: new Set(),
                            moldCountByArm: {}
                        };
                    }
                    acc[produto].totalQuantity += item["Quantidade Programada"];
                    acc[produto].stockTypes.add(stockTypeMap[String(item.Pedido)]);

                    if (braco && moldes !== undefined) {
                        acc[produto].moldCountByArm[braco] = moldes;
                    }

                    return acc;
                }, {});

                const sortedStockProduction = Object.entries(groupedByProduct)
                    .map(([produto, data]) => {
                        const armDetails = Object.entries(data.moldCountByArm)
                            .map(([arm, count]) => `Braço ${arm} (${count})`)
                            .join(', ');
                        return { produto, ...data, armDetails };
                    })
                    .sort((a, b) => b.totalQuantity - a.totalQuantity);

                sortedStockProduction.forEach(item => {
                    const row = estoqueTable.insertRow();
                    row.innerHTML = `
                        <td class="px-4 py-2">${item.produto}</td>
                        <td class="px-4 py-2">${Array.from(item.stockTypes).join(', ')}</td>
                        <td class="px-4 py-2">${item.armDetails}</td>
                        <td class="px-4 py-2">${item.totalQuantity.toLocaleString('pt-BR')}</td>
                    `;
                });
            } else {
                estoqueTable.innerHTML = '<tr><td colspan="4" class="px-4 py-2 text-gray-400 text-center">Nenhum molde está produzindo para estoque.</td></tr>';
            }
        }
    }

    function generateOptimizationSuggestions(data) {
        const container = document.getElementById('sugestoes-otimizacao-container');
        container.innerHTML = ''; // Clear previous suggestions

        // Criteria: Stock orders MED (9999998) and MAX (9999999)
        const removableStockOrderIds = ["9999998", "9999999"];

        // 1. Find removal candidates: Molds producing for stock MED/MAX
        const removalCandidates = (data.programacao_data || [])
            .filter(item => removableStockOrderIds.includes(String(item.Pedido)))
            .map(item => ({
                produto: item.Produto,
                braco: item.Braço,
                tipoEstoque: String(item.Pedido) === "9999998" ? "Estoque Médio" : "Estoque Máximo"
            }))
            // Get unique combinations of product and arm
            .filter((item, index, self) =>
                index === self.findIndex(t => t.produto === item.produto && t.braco === item.braco)
            );

        // 2. Find installation candidates: Molds from "Necessidade Sem Moldes"
        // We prioritize those with higher quantity needed.

        // FIX: Create a separate, normalized list for optimization suggestions
        // to handle cases where the product name is in the 'Nome' property instead of 'Produto'.
        const necessidadeSemMoldesParaOtimizacao = (data.necessidade_sem_moldes_data || []).map(item => {
            return {
                Pedido: item.Pedido,
                Produto: item.Produto || item.Nome,
                Quantidade: item.Quantidade,
                "Qtd. Moldes Cadastrados": item["Qtd. Moldes Cadastrados"]
            };
        });

        const stockOrderIds = ["9999997", "9999998", "9999999"];

        const installationCandidates = necessidadeSemMoldesParaOtimizacao
            // Filtro 1: Garantir que é um problema de molde, não de cadastro
            .filter(item => item["Qtd. Moldes Cadastrados"] > 0)
            // Filtro 2: Garantir que a necessidade é para um pedido de cliente, não de estoque
            .filter(item => item.Pedido && !stockOrderIds.includes(String(parseInt(item.Pedido))))
            .sort((a, b) => b.Quantidade - a.Quantidade);

        if (removalCandidates.length === 0 || installationCandidates.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-center">Nenhuma sugestão de otimização encontrada.</p>';
            return;
        }

        // 3. Generate suggestions by matching candidates
        const suggestions = [];
        const usedInstallationCandidates = new Set();

        for (const removal of removalCandidates) {
            // Find an installation candidate that hasn't been used yet
            const installation = installationCandidates.find(inst => inst.Produto && !usedInstallationCandidates.has(inst.Produto));

            if (installation) {
                suggestions.push({
                    remover: removal,
                    instalar: installation
                });
                // Mark this installation candidate as used to avoid suggesting it again
                usedInstallationCandidates.add(installation.Produto);
            }
        }

        // 4. Display suggestions
        if (suggestions.length > 0) {
            suggestions.forEach(sug => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.className = 'bg-gray-800 p-4 rounded-lg border-l-4 border-yellow-500';
                suggestionDiv.innerHTML = `
                    <div class="flex items-start">
                        <div class="flex-shrink-0">
                            <i class="fas fa-lightbulb text-yellow-400 text-xl"></i>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-gray-300">
                                Para atender a pedidos em espera, considere remover o molde de
                                <strong class="text-white">${sug.remover.produto}</strong> (produzindo para ${sug.remover.tipoEstoque})
                                do <strong class="text-white">Braço ${sug.remover.braco}</strong> e instalar o molde de
                                <strong class="text-white">${sug.instalar.Produto}</strong>.
                            </p>
                            <p class="text-xs text-gray-400 mt-1">
                                Isso pode liberar capacidade para produzir ${sug.instalar.Quantidade.toLocaleString('pt-BR')} itens do produto ${sug.instalar.Produto}.
                            </p>
                        </div>
                    </div>
                `;
                container.appendChild(suggestionDiv);
            });
        } else {
            container.innerHTML = '<p class="text-gray-400 text-center">Nenhuma sugestão de otimização encontrada.</p>';
        }
    }

    function createGanttCharts(data) {
        if (!data.programacao_data) return;

        // Create mold occupation Gantt
        createMoldGantt(data.programacao_data);

        // Create order completion Gantt
        createOrderGantt(data.programacao_data);
    }

    function createMoldGantt(data) {
        const ganttData = processDataForMoldGantt(data);

        if (ganttData.length > 0) {
            const gantt = new Gantt("#gantt-moldes", ganttData, {
                header_height: 50,
                column_width: 30,
                step: 24,
                view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week'],
                bar_height: 20,
                bar_corner_radius: 3,
                arrow_curve: 5,
                padding: 18,
                view_mode: 'Day',
                date_format: 'DD/MM/YYYY',
                custom_popup_html: null
            });

            // Rola o gráfico para a data de hoje
            // A função show_date não existe na v0.6.1. Usando um workaround para rolar para a data atual.
            const today = new Date();
            const today_string = formatDateForGantt(today); // Formato YYYY-MM-DD
            // Os cabeçalhos de data são elementos <text> dentro do SVG principal.
            // A propriedade correta para o SVG é $svg e para o container é $container na v0.6.1.
            const today_element = gantt.$svg.querySelector(`.date-group text[data-date="${today_string}"]`);

            if (today_element && gantt.$container) {
                // Pega a posição X do elemento de data
                const today_x_pos = parseFloat(today_element.getAttribute('x'));
                const text_width = today_element.getBBox().width;
                // Centraliza a data de hoje na visualização do container
                gantt.$container.scrollLeft = today_x_pos + (text_width / 2) - (gantt.$container.offsetWidth / 2);
            }

            // Adiciona a funcionalidade de "cabeçalho fixo" via JavaScript
            const ganttContainer = document.querySelector('#gantt-moldes');
            const header = ganttContainer.querySelector('.grid-header');
            if (ganttContainer && header) {
                // Garante que o cabeçalho seja renderizado por cima de outros elementos SVG
                // movendo-o para o final do seu container SVG pai.
                header.parentNode.appendChild(header);

                ganttContainer.addEventListener('scroll', () => {
                    // Move o grupo do cabeçalho para baixo conforme o scroll vertical sobe
                    header.setAttribute('transform', `translate(0, ${ganttContainer.scrollTop})`);
                });
            }
        }
    }

    function createOrderGantt(data) {
        const ganttData = processDataForOrderGantt(data);

        if (ganttData.length > 0) {
            const gantt = new Gantt("#gantt-pedidos", ganttData, {
                header_height: 50,
                column_width: 30,
                step: 24,
                view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week'],
                bar_height: 20,
                bar_corner_radius: 3,
                arrow_curve: 5,
                padding: 18,
                view_mode: 'Day',
                date_format: 'DD/MM/YYYY',
                custom_popup_html: null
            });

            // Rola o gráfico para a data de hoje
            // A função show_date não existe na v0.6.1. Usando um workaround para rolar para a data atual.
            const today = new Date();
            const today_string = formatDateForGantt(today); // Formato YYYY-MM-DD
            // Os cabeçalhos de data são elementos <text> dentro do SVG principal.
            // A propriedade correta para o SVG é $svg e para o container é $container na v0.6.1.
            const today_element = gantt.$svg.querySelector(`.date-group text[data-date="${today_string}"]`);

            if (today_element && gantt.$container) {
                // Pega a posição X do elemento de data
                const today_x_pos = parseFloat(today_element.getAttribute('x'));
                const text_width = today_element.getBBox().width;
                // Centraliza a data de hoje na visualização do container
                gantt.$container.scrollLeft = today_x_pos + (text_width / 2) - (gantt.$container.offsetWidth / 2);
            }

            // Adiciona a funcionalidade de "cabeçalho fixo" via JavaScript
            const ganttContainer = document.querySelector('#gantt-pedidos');
            const header = ganttContainer.querySelector('.grid-header');
            if (ganttContainer && header) {
                // Garante que o cabeçalho seja renderizado por cima de outros elementos SVG
                // movendo-o para o final do seu container SVG pai.
                header.parentNode.appendChild(header);

                ganttContainer.addEventListener('scroll', () => {
                    // Move o grupo do cabeçalho para baixo conforme o scroll vertical sobe
                    header.setAttribute('transform', `translate(0, ${ganttContainer.scrollTop})`);
                });
            }
        }
    }

    function processDataForMoldGantt(data) {
        const ganttTasks = [];
        const moldOccupation = {};

        // Group dates by mold
        data.forEach(item => {
            const key = `${item.Produto}-${item.Braço}`;
            const date = item["Data Prevista"];

            if (!date) return; // Skip items without a date

            if (!moldOccupation[key]) {
                moldOccupation[key] = {};
            }
            moldOccupation[key][date] = true; // Mark date as occupied
        });

        // Convert to Gantt format
        Object.keys(moldOccupation).forEach((key, index) => {
            let dates = Object.keys(moldOccupation[key]);

            if (dates.length === 0) return;

            // Sort dates chronologically
            dates.sort((a, b) => {
                const [dayA, monthA, yearA] = a.split('/');
                const [dayB, monthB, yearB] = b.split('/');
                return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
            });

            const startDate = convertDateFormat(dates[0]);
            const endDateParts = dates[dates.length - 1].split('/');
            const endDateObj = new Date(endDateParts[2], endDateParts[1] - 1, endDateParts[0]);
            endDateObj.setDate(endDateObj.getDate() + 1); // End date is exclusive in Frappe Gantt

            ganttTasks.push({
                id: `mold-${index}`,
                name: key,
                start: startDate,
                end: formatDateForGantt(endDateObj),
                progress: 100
            });
        });

        return ganttTasks;
    }

    function processDataForOrderGantt(data) {
        const ganttTasks = [];
        const orderProgress = {};

        // Group dates by order
        data.forEach(item => {
            const key = `${item.Pedido}-${item.Produto}`; // Use a composite key for robustness
            const date = item["Data Prevista"];

            if (!date) return; // Skip items without a date

            if (!orderProgress[key]) {
                orderProgress[key] = {};
            }
            orderProgress[key][date] = true; // Mark date as part of the order's timeline
        });

        // Convert to Gantt format
        Object.keys(orderProgress).forEach((key, index) => {
            let dates = Object.keys(orderProgress[key]); // Get unique dates from keys

            if (dates.length === 0) return;

            // Sort dates chronologically
            dates.sort((a, b) => {
                const [dayA, monthA, yearA] = a.split('/');
                const [dayB, monthB, yearB] = b.split('/');
                return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
            });

            const startDate = convertDateFormat(dates[0]);
            const endDateParts = dates[dates.length - 1].split('/');
            const endDateObj = new Date(endDateParts[2], endDateParts[1] - 1, endDateParts[0]);
            endDateObj.setDate(endDateObj.getDate() + 1); // End date is exclusive in Frappe Gantt

            // Add custom classes for styling based on order type
            const orderId = key.split('-')[0];
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
        if (tabName === 'gantt-tab') {
            const ganttContainer = document.getElementById('gantt-moldes');
            // Check if the container is empty and we have data
            if (ganttContainer.innerHTML.trim() === '' && dadosOriginais) {
                // Use a timeout to ensure the container is visible and rendered before creating the chart
                setTimeout(() => {
                    createGanttCharts(dadosOriginais);
                }, 100);
            }
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
        renderProgramacaoPage(1);
        setupProgramacaoPagination();
    }

    function exportProgramacaoToExcel() {
        if (!programacaoFilteredData || programacaoFilteredData.length === 0) {
            alert('Não há dados para exportar. A tabela está vazia ou os filtros não retornaram resultados.');
            return;
        }

        // Create a new worksheet from the filtered data
        // The headers will be inferred from the keys of the first object
        const worksheet = XLSX.utils.json_to_sheet(programacaoFilteredData);

        // Create a new workbook
        const workbook = XLSX.utils.book_new();

        // Append the worksheet to the workbook with a custom sheet name
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
    }

    function setupProgramacaoPagination() {
        const paginationContainer = document.getElementById('programacao-pagination');
        paginationContainer.innerHTML = '';
        const pageCount = Math.ceil(programacaoFilteredData.length / programacaoRowsPerPage);

        if (pageCount <= 1) return;

        const prevButton = document.createElement('button');
        prevButton.innerHTML = '<i class="fas fa-chevron-left mr-2"></i> Anterior';
        prevButton.className = 'bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed';
        prevButton.disabled = programacaoCurrentPage === 1;
        prevButton.addEventListener('click', () => { renderProgramacaoPage(programacaoCurrentPage - 1); setupProgramacaoPagination(); });
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
        nextButton.addEventListener('click', () => { renderProgramacaoPage(programacaoCurrentPage + 1); setupProgramacaoPagination(); });
        paginationContainer.appendChild(nextButton);
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

    async function loadHistorico() {
        try {
            const response = await fetch('/api/programacao/obter_historico');
            const result = await response.json();

            const container = document.getElementById('historico-lista');
            container.innerHTML = '';

            if (response.ok && result.historico && result.historico.length > 0) {
                result.historico.forEach(item => {
                    const date = new Date(item.timestamp).toLocaleString('pt-BR');
                    const isSimulation = item.tipo === 'Simulação de Setup';
                    const description = item.descricao || (isSimulation ? 'Simulação de Setup' : `Braço: ${item.braco_selecionado || 'Todos'}`);

                    const div = document.createElement('div');
                    div.className = `flex items-center justify-between p-3 rounded-lg ${isSimulation ? 'bg-yellow-900 bg-opacity-30 border-l-4 border-yellow-500' : 'bg-gray-700'}`;
                    div.innerHTML = `
                        <div class="flex items-center">
                            <input type="checkbox" class="history-checkbox mr-3" data-id="${item._id}">
                            <div>
                                <span class="text-gray-300 font-medium">${date}</span>
                                ${isSimulation
                            ? `<span class="ml-2 text-xs font-semibold bg-yellow-500 text-black px-2 py-0.5 rounded-full">Simulação</span>`
                            : ''
                        }
                                <p class="text-sm text-secondary">${description}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button class="px-3 py-1 bg-accent text-white rounded hover:bg-accent-dark" onclick="carregarProgramacaoHistorico('${item._id}')">
                                Carregar
                            </button>
                            <button class="px-3 py-1 bg-error text-white rounded hover:bg-error-dark" onclick="excluirProgramacaoHistorico('${item._id}')">
                                Excluir
                            </button>
                        </div>
                    `;
                    container.appendChild(div);
                });

                // Add event listeners for checkboxes
                document.querySelectorAll('.history-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', updateCompareButton);
                });
            } else {
                container.innerHTML = '<p class="text-gray-400">Nenhum histórico encontrado</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            document.getElementById('historico-lista').innerHTML = '<p class="text-red-400">Erro ao carregar histórico</p>';
        }
    }

    function updateCompareButton() {
        const checkedBoxes = document.querySelectorAll('.history-checkbox:checked');
        const compareBtn = document.getElementById('comparar-btn');

        if (checkedBoxes.length === 2) {
            compareBtn.disabled = false;
            compareBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            compareBtn.disabled = true;
            compareBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    async function compararProgramacoes() {
        const checkedBoxes = document.querySelectorAll('.history-checkbox:checked');
        if (checkedBoxes.length !== 2) {
            alert('Por favor, selecione exatamente duas programações para comparar.');
            return;
        }

        const ids = Array.from(checkedBoxes).map(cb => cb.dataset.id);
        const programacao_id_1 = ids[0];
        const programacao_id_2 = ids[1];

        showLoading();

        try {
            const response = await fetch('/api/gantt/comparar_programacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ programacao_id_1, programacao_id_2 })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao comparar programações');
            }

            displayComparisonResults(result);

        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    function displayComparisonResults(data) {
        const container = document.getElementById('comparison-content');
        const resultsDiv = document.getElementById('comparison-results');

        if (!data || !data.comparacao) {
            container.innerHTML = '<p class="text-red-400">Não foi possível obter os resultados da comparação.</p>';
            resultsDiv.classList.remove('hidden');
            return;
        }

        const { comparacao, estatisticas, info_programacoes } = data;

        let tableRows = '';
        comparacao.forEach(item => {
            let statusClass = '';
            let statusText = '';
            if (item.status === 'atrasou') {
                statusClass = 'text-red-400';
                statusText = `Atrasou ${item.diferenca_dias} dias`;
            } else if (item.status === 'adiantou') {
                statusClass = 'text-green-400';
                statusText = `Adiantou ${Math.abs(item.diferenca_dias)} dias`;
            } else {
                statusClass = 'text-gray-400';
                statusText = 'Sem alteração';
            }

            tableRows += `
                <tr class="border-b border-gray-700 hover:bg-gray-700">
                    <td class="p-3">${item.pedido}</td>
                    <td class="p-3">${item.produto}</td>
                    <td class="p-3">${item.data_prog1}</td>
                    <td class="p-3">${item.data_prog2}</td>
                    <td class="p-3 ${statusClass} font-semibold">${statusText}</td>
                </tr>
            `;
        });

        const prog1Date = new Date(info_programacoes.prog1.timestamp).toLocaleString('pt-BR') + (info_programacoes.prog1.descricao ? ` (${info_programacoes.prog1.descricao})` : '');
        const prog2Date = new Date(info_programacoes.prog2.timestamp).toLocaleString('pt-BR') + (info_programacoes.prog2.descricao ? ` (${info_programacoes.prog2.descricao})` : '');

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
                <div class="bg-gray-700 p-4 rounded-lg">
                    <p class="text-sm text-gray-400">Total de Pedidos Comparados</p>
                    <p class="text-2xl font-bold">${estatisticas.total_pedidos}</p>
                </div>
                <div class="bg-gray-700 p-4 rounded-lg">
                    <p class="text-sm text-green-400">Pedidos Adiantados</p>
                    <p class="text-2xl font-bold text-green-400">${estatisticas.adiantaram}</p>
                </div>
                <div class="bg-gray-700 p-4 rounded-lg">
                    <p class="text-sm text-red-400">Pedidos Atrasados</p>
                    <p class="text-2xl font-bold text-red-400">${estatisticas.atrasaram}</p>
                </div>
            </div>
            <p class="text-gray-400 mb-4">Comparando programação de <span class="font-semibold text-accent">${prog1Date}</span> com <span class="font-semibold text-accent">${prog2Date}</span>.</p>
            <div class="overflow-x-auto">
                <table class="min-w-full text-sm text-left text-gray-300">
                    <thead class="text-xs text-gray-200 uppercase bg-gray-600">
                        <tr>
                            <th class="p-3">Pedido</th>
                            <th class="p-3">Produto</th>
                            <th class="p-3">Data Conclusão (Prog. 1)</th>
                            <th class="p-3">Data Conclusão (Prog. 2)</th>
                            <th class="p-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;

        resultsDiv.classList.remove('hidden');
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
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

    async function carregarUltimoPlanejamento() {
        showLoading();
        const success = await fetchAndSetLatestPlanningData();
        if (success) {
            showSection('planejamento');
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
    window.showSection = showSection;
    window.carregarUltimoPlanejamento = carregarUltimoPlanejamento;
    window.carregarProgramacaoHistorico = async function (id) {
        showLoading();
        try {
            const response = await fetch(`/api/gantt/obter_planejamento/${id}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Planejamento não encontrado');
            }

            showSection('planejamento');
            goToStep(3);

            showResults(result);
            document.getElementById('results-tabs').classList.remove('hidden');
            document.getElementById('enviar-sankhya-btn').classList.remove('hidden');

            dadosOriginais = result;

        } catch (error) {
            alert(`Erro ao carregar planejamento do histórico: ${error.message}`);
        } finally {
            hideLoading();
        }
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
            loadHistorico();
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

    async function loadAtrasosHistorico() {
        try {
            // Fetch both delay history and reasons in parallel
            const [atrasosResponse, motivosResponse] = await Promise.all([
                fetch('/api/gantt/historico_atrasos'),
                fetch('/api/gantt/motivos/listar')
            ]);

            const atrasosResult = await atrasosResponse.json();
            const motivosResult = await motivosResponse.json();

            const container = document.getElementById('historico-atrasos-container');
            container.innerHTML = '';

            if (atrasosResponse.ok && atrasosResult.historico_atrasos && atrasosResult.historico_atrasos.length > 0) {
                const motivosOptions = motivosResponse.ok
                    ? motivosResult.motivos.map(m => `<option value="${m.motivo}">${m.motivo}</option>`).join('')
                    : '';

                const table = document.createElement('table');
                table.className = 'min-w-full text-sm text-left text-gray-300';

                table.innerHTML = `
                    <thead class="text-xs text-gray-200 uppercase bg-gray-600">
                        <tr>
                            <th class="px-4 py-3">Data da Análise</th>
                            <th class="px-4 py-3">Número do Pedido</th>
                            <th class="px-4 py-3">Nome do Cliente</th>
                            <th class="px-4 py-3">Dias de Atraso</th>
                            <th class="px-4 py-3">Motivo da Ocorrência</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${atrasosResult.historico_atrasos.map(item => {
                    const detailsId = `atraso-details-${item._id}`;
                    const hasDetails = item.itens_causadores && item.itens_causadores.length > 0;

                    const mainRow = `
                                <tr class="border-b border-gray-700 hover:bg-gray-700 ${hasDetails ? 'cursor-pointer' : ''}" ${hasDetails ? `onclick="toggleAtrasoDetails('${detailsId}')"` : ''}>
                                    <td class="px-4 py-2">
                                        ${hasDetails ? `<i id="icon-${detailsId}" class="fas fa-chevron-right mr-2 transition-transform duration-200"></i>` : '<span class="inline-block w-6"></span>'}
                                        ${new Date(item.timestamp_analise).toLocaleString('pt-BR')}
                                    </td>
                                    <td class="px-4 py-2">${item.pedido}</td>
                                    <td class="px-4 py-2">${item.cliente}</td>
                                    <td class="px-4 py-2 text-red-400 font-semibold">${item.dias_atraso}</td>
                                    <td class="px-4 py-2">
                                        ${item.motivo_atraso
                            ? `<span class="font-semibold text-yellow-400">${item.motivo_atraso}</span>`
                            : `
                                            <div class="flex items-center space-x-2" onclick="event.stopPropagation()">
                                                <select class="motivo-select bg-gray-700 text-white text-xs rounded p-1" data-atraso-id="${item._id}">
                                                    <option value="">Selecione...</option>
                                                    ${motivosOptions}
                                                </select>
                                                <button class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 text-xs rounded" onclick="atribuirMotivo(this)">Salvar</button>
                                            </div>
                                            `
                        }
                                    </td>
                                </tr>
                            `;

                    let detailsRow = '';
                    if (hasDetails) {
                        const detailsContent = item.itens_causadores.map(causa => `
                                    <tr class="bg-gray-900 hover:bg-gray-800">
                                        <td class="px-8 py-2">${causa.produto} (Cód: ${causa.codprod || 'N/A'})</td>
                                        <td class="px-8 py-2">${causa.cor || 'N/A'}</td>
                                        <td class="px-8 py-2">${causa.data_prevista}</td>
                                        <td class="px-8 py-2 text-red-500">${causa.dias_atraso_item} dias</td>
                                    </tr>
                                `).join('');

                        detailsRow = `
                                    <tr id="${detailsId}" class="hidden">
                                        <td colspan="5" class="p-0 bg-gray-800">
                                            <div class="p-4">
                                                <h5 class="text-md font-semibold text-gray-300 mb-2 ml-2">Itens que impactaram o prazo:</h5>
                                                <table class="min-w-full text-xs text-left text-gray-400">
                                                    <thead class="bg-gray-700">
                                                        <tr>
                                                            <th class="px-8 py-2">Produto</th>
                                                            <th class="px-8 py-2">Cor</th>
                                                            <th class="px-8 py-2">Nova Data Prevista</th>
                                                            <th class="px-8 py-2">Atraso Gerado pelo Item</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>${detailsContent}</tbody>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                    }
                    return mainRow + detailsRow;
                }).join('')}
                    </tbody>
                `;
                container.appendChild(table);
            } else {
                container.innerHTML = '<p class="text-gray-400">Nenhum histórico de atrasos encontrado.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar histórico de atrasos:', error);
            document.getElementById('historico-atrasos-container').innerHTML = '<p class="text-red-400">Erro ao carregar histórico de atrasos.</p>';
        }
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

    window.atribuirMotivo = async function (buttonElement) {
        const selectElement = buttonElement.previousElementSibling;
        const atrasoId = selectElement.dataset.atrasoId;
        const motivo = selectElement.value;
        if (!motivo) { alert('Por favor, selecione um motivo.'); return; }
        showLoading();
        try {
            const response = await fetch(`/api/gantt/atrasos/atribuir_motivo/${atrasoId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: motivo }) });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.error || 'Erro ao atribuir motivo'); }
            alert(result.message);
            const cell = buttonElement.parentElement.parentElement;
            cell.innerHTML = `<span class="font-semibold text-yellow-400">${motivo}</span>`;
        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            hideLoading();
        }
    };

    window.toggleAtrasoDetails = function (detailsId) {
        const detailsRow = document.getElementById(detailsId);
        const icon = document.getElementById(`icon-${detailsId}`);
        if (detailsRow && icon) {
            detailsRow.classList.toggle('hidden');
            icon.classList.toggle('fa-chevron-right');
            icon.classList.toggle('fa-chevron-down');
        }
    };

    async function loadHistoricoParaRelatorios() {
        const select = document.getElementById('relatorio-programacao-select');
        const button = document.getElementById('gerar-pdf-btn');
        select.innerHTML = '<option>Carregando histórico...</option>';
        button.disabled = true;

        try {
            const response = await fetch('/api/programacao/obter_historico');
            const result = await response.json();

            if (response.ok && result.historico && result.historico.length > 0) {
                select.innerHTML = '<option value="">Selecione uma programação</option>';
                result.historico.forEach(item => {
                    const date = new Date(item.timestamp).toLocaleString('pt-BR');
                    const option = document.createElement('option');
                    option.value = item._id;
                    option.textContent = `${date} - Braço: ${item.braco_selecionado || 'Todos'}`;
                    select.appendChild(option);
                });
                select.onchange = () => {
                    button.disabled = select.value === '';
                };
            } else {
                select.innerHTML = '<option>Nenhum histórico encontrado</option>';
            }
        } catch (error) {
            console.error('Erro ao carregar histórico para relatórios:', error);
            select.innerHTML = '<option>Erro ao carregar histórico</option>';
        }
    }

    async function gerarRelatorioPDF() {
        const select = document.getElementById('relatorio-programacao-select');
        const programacaoId = select.value;

        if (!programacaoId) {
            alert('Por favor, selecione uma programação para gerar o relatório.');
            return;
        }

        showLoading();
        const button = document.getElementById('gerar-pdf-btn');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando...';

        try {
            const response = await fetch(`/api/gantt/gerar_relatorio_pdf/${programacaoId}`, { method: 'POST' });
            if (!response.ok) { throw new Error('Erro no servidor ao gerar o PDF.'); }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            // d:\planejamento 0.79\src\static\script_new.js

            async function gerarProgramacao() {
                showLoading();

                try {
                    // ... (código de upload e configuração)

                    // Generate planning
                    const response = await fetch('/api/programacao/gerar_programacao', {
                        // ...
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.error || 'Erro ao gerar programação');
                    }

                    // Store results
                    dadosOriginais = result;

                    // OTIMIZAÇÃO: Se o backend pré-calculou os dados da projeção, armazena em cache imediatamente.
                    if (result.projecao_data && result._id) {
                        projecaoCache[result._id] = result.projecao_data;
                        console.log('Dados de projeção pré-calculados e cacheados com sucesso na geração.');
                    } else {
                        projecaoCache = {}; // Limpa o cache se não houver dados de projeção
                    }

                    // Show results
                    showResults(result);
                    // ...

                } catch (error) {
                    alert(`Erro: ${error.message}`);
                } finally {
                    hideLoading();
                }
            }
            const a = document.createElement('a');
            a.style.display = 'none'; a.href = url; a.download = `relatorio_programacao_${programacaoId}.pdf`;
            document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
        } catch (error) {
            alert(`Erro ao gerar relatório: ${error.message}`);
        } finally {
            hideLoading();
            button.disabled = false; button.innerHTML = '<i class="fas fa-file-pdf mr-2"></i>Gerar PDF';
        }
    }

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
            loadHistorico();
            loadHistoricoRecente();

        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            hideLoading();
        }
    };
});
