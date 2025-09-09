document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    // Cache keys
    const HISTORICO_CACHE_KEY = 'analiseHistorica_historico';
    const ATRASOS_CACHE_KEY = 'analiseHistorica_atrasos';
    const MOTIVOS_CACHE_KEY = 'analiseHistorica_motivos';
    let motivosAtrasoChartInstance = null;

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        displayActivePlanBanner();
        initializeAIChat(); // Adiciona a inicialização do modal da IA
    }

    function setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const href = item.getAttribute('href');
                if (href && href !== '#') {
                    // Allow default navigation for external links
                    return;
                }
                e.preventDefault();
                const section = item.dataset.section;
                showSection(section);
                updateActiveNavItem(item);
            });
        });

        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

        // Compare history
        document.getElementById('comparar-btn').addEventListener('click', compararProgramacoes);
    }

    // Initial data load on page view
    loadHistorico();
    loadAtrasosHistorico();

    function showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show selected section
        const sectionToShow = document.getElementById(`${sectionName}-section`);
        if (sectionToShow) {
            sectionToShow.classList.remove('hidden');
        }

        // Carrega dados específicos da seção quando ela é exibida
        if (sectionName === 'analise') {
            loadAtrasosHistorico();
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

    async function loadHistorico(forceReload = false) {
        if (!forceReload) {
            const cachedData = sessionStorage.getItem(HISTORICO_CACHE_KEY);
            if (cachedData) {
                console.log("Carregando histórico de programações do cache da sessão.");
                renderHistoricoList(JSON.parse(cachedData));
                return;
            }
        }

        console.log("Buscando histórico de programações do servidor.");
        try {
            const response = await fetch('/api/programacao/obter_historico');
            const result = await response.json();

            if (response.ok && result.historico) {
                sessionStorage.setItem(HISTORICO_CACHE_KEY, JSON.stringify(result.historico));
                renderHistoricoList(result.historico);
            } else {
                document.getElementById('historico-lista').innerHTML = `<p class="text-gray-400">${result.error || 'Nenhum histórico encontrado'}</p>`;
            }
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            document.getElementById('historico-lista').innerHTML = '<p class="text-red-400">Erro ao carregar histórico</p>';
        }
    }

    function renderHistoricoList(historico) {
        const container = document.getElementById('historico-lista');
        container.innerHTML = '';

        if (historico && historico.length > 0) {
            historico.forEach(item => {
                const date = new Date(item.timestamp).toLocaleString('pt-BR');
                const isSimulation = item.tipo === 'Simulação de Setup';
                const shortDescription = item.descricao || (isSimulation ? 'Simulação de Setup' : `Braço: ${item.braco_selecionado || 'Todos'}`);
                const bannerDescription = `${shortDescription} (Gerado em: ${date})`;

                const div = document.createElement('div');
                div.className = `flex items-center justify-between p-3 rounded-lg ${isSimulation ? 'bg-yellow-900 bg-opacity-30 border-l-4 border-yellow-500' : 'bg-gray-700'}`;
                div.innerHTML = `
                    <div class="flex items-center">
                        <input type="checkbox" class="history-checkbox mr-3" data-id="${item._id}">
                        <div>
                            <span class="text-gray-300 font-medium">${date}</span>
                            ${isSimulation ? `<span class="ml-2 text-xs font-semibold bg-yellow-500 text-black px-2 py-0.5 rounded-full">Simulação</span>` : ''}
                            <p class="text-sm text-secondary">${shortDescription}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button class="px-3 py-1 bg-accent text-white rounded hover:bg-accent-dark" onclick="carregarProgramacaoHistorico('${item._id}', '${bannerDescription.replace(/'/g, "\\'")}')">Carregar</button>
                        <button class="px-3 py-1 bg-error text-white rounded hover:bg-error-dark" onclick="excluirProgramacaoHistorico('${item._id}')">Excluir</button>
                    </div>
                `;
                container.appendChild(div);
            });

            document.querySelectorAll('.history-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', updateCompareButton);
            });
        } else {
            container.innerHTML = '<p class="text-gray-400">Nenhum histórico encontrado</p>';
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

    function showLoading() {
        document.getElementById('loading-layer').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('loading-layer').classList.add('hidden');
    }

    window.carregarProgramacaoHistorico = async function (id, description) {
        if (!id) return;

        // Define o planejamento ativo no sessionStorage para ser usado em todo o sistema
        sessionStorage.setItem('activePlanId', id);
        sessionStorage.setItem('activePlanDescription', description);

        // Redireciona para a página de planejamento, que agora lerá o ID do sessionStorage
        window.location.href = `planejamento.html`;
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

            alert(result.message);
            loadHistorico(true); // Força o recarregamento do histórico

        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            hideLoading();
        }
    };

    async function loadAtrasosHistorico(forceReload = false) {
        if (!forceReload) {
            const cachedAtrasos = sessionStorage.getItem(ATRASOS_CACHE_KEY);
            const cachedMotivos = sessionStorage.getItem(MOTIVOS_CACHE_KEY);
            if (cachedAtrasos && cachedMotivos) {
                console.log("Carregando histórico de atrasos e motivos do cache da sessão.");
                renderAtrasosHistorico(JSON.parse(cachedAtrasos), JSON.parse(cachedMotivos));
                return;
            }
        }

        console.log("Buscando histórico de atrasos e motivos do servidor.");
        try {
            const [atrasosResponse, motivosResponse] = await Promise.all([
                fetch('/api/gantt/historico_atrasos'),
                fetch('/api/gantt/motivos/listar')
            ]);

            const atrasosResult = await atrasosResponse.json();
            const motivosResult = await motivosResponse.json();

            if (atrasosResponse.ok && motivosResponse.ok) {
                sessionStorage.setItem(ATRASOS_CACHE_KEY, JSON.stringify(atrasosResult.historico_atrasos));
                sessionStorage.setItem(MOTIVOS_CACHE_KEY, JSON.stringify(motivosResult.motivos));
                renderAtrasosHistorico(atrasosResult.historico_atrasos, motivosResult.motivos);
            } else {
                throw new Error('Falha ao carregar dados de atrasos ou motivos.');
            }
        } catch (error) {
            console.error('Erro ao carregar histórico de atrasos:', error);
            document.getElementById('historico-atrasos-container').innerHTML = '<p class="text-red-400">Erro ao carregar histórico de atrasos.</p>';
        }
    }

    function renderAtrasosHistorico(historicoAtrasos, motivos) {
        const container = document.getElementById('historico-atrasos-container');
        createMotivosAtrasoChart(historicoAtrasos); // Gera o gráfico de motivos

        container.innerHTML = '';

        if (historicoAtrasos && historicoAtrasos.length > 0) {
            const motivosOptions = motivos.map(m => `<option value="${m.motivo}">${m.motivo}</option>`).join('');

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
                    ${historicoAtrasos.map(item => {
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
    }

    function createMotivosAtrasoChart(historicoAtrasos) {
        const container = document.getElementById('motivos-chart-container');
        let canvas = document.getElementById('motivos-atraso-chart');

        if (!canvas) {
            container.innerHTML = '';
            canvas = document.createElement('canvas');
            canvas.id = 'motivos-atraso-chart';
            container.appendChild(canvas);
        }

        if (motivosAtrasoChartInstance) {
            motivosAtrasoChartInstance.destroy();
        }

        if (!historicoAtrasos || historicoAtrasos.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-8">Sem dados para exibir o gráfico de motivos.</p>';
            return;
        }

        const motivosCount = historicoAtrasos.reduce((acc, item) => {
            const motivo = item.motivo_atraso || 'Não Atribuído';
            acc[motivo] = (acc[motivo] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(motivosCount);
        const data = Object.values(motivosCount);

        const ctx = canvas.getContext('2d');
        motivosAtrasoChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ocorrências',
                    data: data,
                    backgroundColor: [
                        'rgba(52, 152, 219, 0.8)', // Accent
                        'rgba(231, 76, 60, 0.8)',  // Error
                        'rgba(241, 196, 15, 0.8)', // Warning
                        'rgba(46, 204, 113, 0.8)', // Success
                        'rgba(155, 89, 182, 0.8)', // Purple
                        'rgba(26, 188, 156, 0.8)', // Teal
                        'rgba(230, 126, 34, 0.8)', // Orange
                        'rgba(149, 165, 166, 0.8)'  // Gray
                    ],
                    borderColor: 'var(--color-bg-light)',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: 'var(--color-text-main)', padding: 20 } },
                    tooltip: { callbacks: { label: (c) => `${c.label}: ${c.raw} ocorrência(s)` } },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 14 },
                        formatter: (value, ctx) => {
                            const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = (value * 100 / sum).toFixed(0) + '%';
                            return value > 0 ? percentage : '';
                        }
                    }
                }
            }
        });
    }

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

            // Atualiza o cache para refletir a mudança
            const cachedAtrasos = JSON.parse(sessionStorage.getItem(ATRASOS_CACHE_KEY) || '[]');
            const itemIndex = cachedAtrasos.findIndex(item => item._id === atrasoId);
            if (itemIndex > -1) {
                cachedAtrasos[itemIndex].motivo_atraso = motivo;
                sessionStorage.setItem(ATRASOS_CACHE_KEY, JSON.stringify(cachedAtrasos));
            }

            // Atualiza a UI
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
});