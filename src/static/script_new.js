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
        loadDashboardData(); // Carrega KPIs e histórico recente
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
        if (data.necessidade_sem_moldes_data && data.necessidade_sem_moldes_data.length > 0) {
            const withoutMolds = data.necessidade_sem_moldes_data.length;
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
                    data: quantidadesTotais,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Quantidade para Estoque',
                    data: quantidadesEstoque,
                    borderColor: 'rgba(16, 185, 129, 1)', // Cor verde para diferenciar
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
        const table = document.getElementById('programacao-table');
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
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

            const container = document.getElementById('gantt-comparacao-atrasos');
            container.innerHTML = ''; // Limpa a mensagem de "carregando"

            if (response.ok && result.gantt_data && result.gantt_data.length > 0) {
                createComparisonGantt(result.gantt_data);
            } else {
                container.innerHTML = `<p class="text-gray-400">${result.message || 'Não há dados de atraso para exibir.'}</p>`;
            }
        } catch (error) {
            console.error('Erro ao carregar Gantt de comparação:', error);
            document.getElementById('gantt-comparacao-atrasos').innerHTML = '<p class="text-red-400">Erro ao carregar análise de atrasos.</p>';
        }
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
                view_mode: 'Week',
                date_format: 'DD/MM/YYYY',
                custom_popup_html: (task) => `
                    <div class="p-2 bg-gray-800 text-white rounded-md shadow-lg">
                        <div class="font-bold">${task.name}</div>
                        <p>Início: ${new Date(task._start).toLocaleDateString('pt-BR')}</p>
                        <p>Fim: ${new Date(task._end).toLocaleDateString('pt-BR')}</p>
                    </div>`
            });

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
        const semMolde = data.necessidade_sem_moldes_data ? data.necessidade_sem_moldes_data.length : 0;
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
            document.getElementById('enviar-sankhya-btn').classList.remove('hidden');
            
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
            document.getElementById('enviar-sankhya-btn').classList.remove('hidden');
            
            dadosOriginais = result;

        } catch (error) {
            alert(`Erro ao carregar planejamento do histórico: ${error.message}`);
        } finally {
            hideLoading();
        }
    };
});
