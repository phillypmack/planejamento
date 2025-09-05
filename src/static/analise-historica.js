document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let dadosOriginais = null;
    let selectedHistoryItems = [];
    let motivosOcorrenciaCache = null;

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        loadHistorico();
        loadAtrasosHistorico();
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

    function showLoading() {
        document.getElementById('loading-layer').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('loading-layer').classList.add('hidden');
    }

    window.carregarProgramacaoHistorico = async function (id) {
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

            alert(result.message);
            loadHistorico();

        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            hideLoading();
        }
    };

    async function loadAtrasosHistorico() {
        try {
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
});