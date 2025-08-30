document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let currentStep = 1;
    let setupFile = null;
    let faltasFile = null;
    let cadastroMoldesFile = null;
    let dadosOriginais = null;
    let selectedHistoryItems = [];

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        loadDashboardData();
        loadHistorico();
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

        // Compare history
        document.getElementById('comparar-btn').addEventListener('click', compararProgramacoes);
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
        
        sidebar.classList.toggle('sidebar-collapsed');
        mainContent.classList.toggle('content-expanded');
        
        if (sidebar.classList.contains('sidebar-collapsed')) {
            mainContent.classList.remove('ml-64');
            mainContent.classList.add('ml-0');
        } else {
            mainContent.classList.remove('ml-0');
            mainContent.classList.add('ml-64');
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
                modo_sequenciamento: document.getElementById('modo-sequenciamento').value,
                priorizacao_pedidos: document.getElementById('priorizacao-pedidos').value
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
        const semMolde = data.necessidade_sem_moldes_data ? data.necessidade_sem_moldes_data.length : 0;
        
        document.getElementById('resumo-pedidos').textContent = pedidos;
        document.getElementById('resumo-ociosos').textContent = ociosos;
        document.getElementById('resumo-sem-molde').textContent = semMolde;
        document.getElementById('resumo-ocupacao').textContent = '85%'; // Calculate based on data
    }

    function generateAlerts(data) {
        const alertsContainer = document.getElementById('alertas-lista');
        alertsContainer.innerHTML = '';

        const alerts = [];

        // Check for critical orders
        if (data.programacao_data) {
            const priorityOrders = data.programacao_data.filter(item => 
                !["9999997", "9999998", "9999999"].includes(String(item.Pedido))
            );
            if (priorityOrders.length > 0) {
                alerts.push({
                    type: 'info',
                    message: `${priorityOrders.length} pedidos prioritários foram programados.`
                });
            }
        }

        // Check for idle molds
        if (data.moldes_ociosos_data && data.moldes_ociosos_data.length > 0) {
            const idleMolds = data.moldes_ociosos_data.length;
            alerts.push({
                type: 'warning',
                message: `${idleMolds} moldes ficarão ociosos durante o período.`
            });
        }

        // Check for products without molds
        if (data.necessidade_sem_moldes_data && data.necessidade_sem_moldes_data.length > 0) {
            const withoutMolds = data.necessidade_sem_moldes_data.length;
            alerts.push({
                type: 'error',
                message: `${withoutMolds} produtos precisam de moldes para atender a demanda.`
            });
        }

        // Render alerts
        alerts.forEach(alert => {
            const alertDiv = document.createElement('div');
            alertDiv.className = `p-3 rounded-lg mb-2 ${getAlertClass(alert.type)}`;
            alertDiv.innerHTML = `
                <div class="flex items-center">
                    <i class="fas ${getAlertIcon(alert.type)} mr-2"></i>
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
            case 'error': return 'bg-red-600 text-white';
            case 'warning': return 'bg-yellow-600 text-white';
            case 'info': return 'bg-blue-600 text-white';
            default: return 'bg-gray-600 text-white';
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
                    data: quantidades,
                    backgroundColor: 'rgba(147, 51, 234, 0.6)',
                    borderColor: 'rgba(147, 51, 234, 1)',
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
        
        const datas = [...new Set(data.map(item => item["Data Prevista"]))].sort();
        const quantidades = datas.map(data_item =>
            data.filter(item => item["Data Prevista"] === data_item)
                .reduce((sum, item) => sum + item["Quantidade Programada"], 0)
        );

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: datas,
                datasets: [{
                    label: 'Quantidade por Data',
                    data: quantidades,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
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
                        'rgba(234, 179, 8, 0.6)',
                        'rgba(234, 88, 12, 0.6)',
                        'rgba(168, 85, 247, 0.6)',
                        'rgba(59, 130, 246, 0.6)',
                        'rgba(34, 197, 94, 0.6)',
                        'rgba(239, 68, 68, 0.6)'
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
                        'rgba(147, 51, 234, 0.6)',
                        'rgba(79, 70, 229, 0.6)',
                        'rgba(59, 130, 246, 0.6)',
                        'rgba(16, 185, 129, 0.6)',
                        'rgba(245, 158, 11, 0.6)',
                        'rgba(239, 68, 68, 0.6)'
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
        const programacaoTable = document.getElementById('programacao-table').querySelector('tbody');
        programacaoTable.innerHTML = '';
        
        if (data.programacao_data) {
            data.programacao_data.forEach(item => {
                const row = programacaoTable.insertRow();
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
            data.necessidade_sem_moldes_data.forEach(item => {
                const row = necessidadeTable.insertRow();
                row.innerHTML = `
                    <td class="px-4 py-2">${item.Nome}</td>
                    <td class="px-4 py-2">${item.Quantidade}</td>
                    <td class="px-4 py-2">${item["Qtd. Moldes Cadastrados"]}</td>
                `;
            });
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
            gantt.show_date(new Date());
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
            gantt.show_date(new Date());
        }
    }

    function processDataForMoldGantt(data) {
        const ganttTasks = [];
        const moldOccupation = {};

        // Group by mold and date
        data.forEach(item => {
            const key = `${item.Produto}-${item.Braço}`;
            const date = item["Data Prevista"];
            
            if (!moldOccupation[key]) {
                moldOccupation[key] = {};
            }
            
            if (!moldOccupation[key][date]) {
                moldOccupation[key][date] = {
                    start: date,
                    end: date,
                    quantity: 0
                };
            }
            
            moldOccupation[key][date].quantity += item["Quantidade Programada"];
        });

        // Convert to Gantt format
        Object.keys(moldOccupation).forEach((key, index) => {
            let dates = Object.keys(moldOccupation[key]);

            // Sort dates chronologically
            dates.sort((a, b) => {
                const [dayA, monthA, yearA] = a.split('/');
                const [dayB, monthB, yearB] = b.split('/');
                return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
            });

            if (dates.length > 0) {
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
            }
        });

        return ganttTasks;
    }

    function processDataForOrderGantt(data) {
        const ganttTasks = [];
        const orderProgress = {};

        // Group by order
        data.forEach(item => {
            const orderId = item.Pedido;
            const date = item["Data Prevista"];
            
            if (!orderProgress[orderId]) {
                orderProgress[orderId] = {};
            }
            
            if (!orderProgress[orderId][date]) {
                orderProgress[orderId][date] = {
                    quantity: 0
                };
            }
            
            orderProgress[orderId][date].quantity += item["Quantidade Programada"];
        });

        // Convert to Gantt format
        Object.keys(orderProgress).forEach((orderId, index) => {
            let dates = Object.keys(orderProgress[orderId]); // Get unique dates from keys

            // Sort dates chronologically
            dates.sort((a, b) => {
                const [dayA, monthA, yearA] = a.split('/');
                const [dayB, monthB, yearB] = b.split('/');
                return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
            });

            if (dates.length > 0) {
                const startDate = convertDateFormat(dates[0]);
                const endDateParts = dates[dates.length - 1].split('/');
                const endDateObj = new Date(endDateParts[2], endDateParts[1] - 1, endDateParts[0]);
                endDateObj.setDate(endDateObj.getDate() + 1); // End date is exclusive in Frappe Gantt
                
                ganttTasks.push({
                    id: `order-${index}`,
                    name: `Pedido ${orderId}`,
                    start: startDate,
                    end: formatDateForGantt(endDateObj),
                    progress: 100
                });
            }
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
                createGanttCharts(dadosOriginais);
            }
        }
    }

    function filterProgramacao() {
        const searchTerm = document.getElementById('search-programacao').value.toLowerCase();
        const table = document.getElementById('programacao-table');
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    function loadDashboardData() {
        // Load recent history for dashboard
        loadHistoricoRecente();
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
                    const div = document.createElement('div');
                    div.className = 'flex justify-between items-center p-3 bg-gray-700 rounded-lg';
                    div.innerHTML = `
                        <div>
                            <span class="text-gray-300">${date}</span>
                            <span class="text-gray-400 ml-2">Braço: ${item.braco_selecionado || 'Todos'}</span>
                        </div>
                        <button class="text-purple-400 hover:text-purple-300" onclick="carregarProgramacaoHistorico('${item._id}')">
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
                    const div = document.createElement('div');
                    div.className = 'flex items-center justify-between p-3 bg-gray-700 rounded-lg';
                    div.innerHTML = `
                        <div class="flex items-center">
                            <input type="checkbox" class="history-checkbox mr-3" data-id="${item._id}">
                            <div>
                                <span class="text-gray-300 font-medium">${date}</span>
                                <span class="text-gray-400 ml-4">Braço: ${item.braco_selecionado || 'Todos'}</span>
                            </div>
                        </div>
                        <button class="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700" onclick="carregarProgramacaoHistorico('${item._id}')">
                            Carregar
                        </button>
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
    
        const prog1Date = new Date(info_programacoes.prog1.timestamp).toLocaleString('pt-BR');
        const prog2Date = new Date(info_programacoes.prog2.timestamp).toLocaleString('pt-BR');
    
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
            <p class="text-gray-400 mb-4">Comparando programação de <span class="font-semibold text-purple-400">${prog1Date}</span> com <span class="font-semibold text-purple-400">${prog2Date}</span>.</p>
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
        if (data.programacao_data) {
            const pedidos = new Set(data.programacao_data.map(item => item.Pedido)).size;
            document.getElementById('kpi-pedidos').textContent = pedidos;
        }

        if (data.moldes_ociosos_data) {
            document.getElementById('kpi-ociosos').textContent = data.moldes_ociosos_data.length;
        }

        if (data.necessidade_sem_moldes_data) {
            document.getElementById('kpi-criticos').textContent = data.necessidade_sem_moldes_data.length;
        }

        document.getElementById('kpi-ocupacao').textContent = '85%'; // Calculate based on actual data
    }

    async function carregarUltimoPlanejamento() {
        showLoading();
        try {
            const response = await fetch('/api/gantt/obter_ultimo_planejamento');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Nenhum planejamento encontrado no histórico');
            }

            const latest = result.ultimo_planejamento;
            
            showSection('planejamento');
            goToStep(3);
            
            showResults(latest);
            document.getElementById('results-tabs').classList.remove('hidden');
            
            dadosOriginais = latest;

        } catch (error) {
            alert(`Erro ao carregar último planejamento: ${error.message}`);
        } finally {
            hideLoading();
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
    window.carregarUltimoPlanejamento = carregarUltimoPlanejamento;
    window.carregarProgramacaoHistorico = async function(id) {
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
            
            dadosOriginais = result;

        } catch (error) {
            alert(`Erro ao carregar planejamento do histórico: ${error.message}`);
        } finally {
            hideLoading();
        }
    };
});
