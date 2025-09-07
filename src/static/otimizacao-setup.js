document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let dadosOriginais = null;

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        loadOtimizacaoData(); // Tenta carregar do cache ao iniciar
    }

    function setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

        // Otimização de Setup
        document.getElementById('load-latest-for-otimizacao-btn').addEventListener('click', () => loadOtimizacaoData(true));
        document.getElementById('reset-simulation-btn').addEventListener('click', handleResetOtimizacao);
        document.getElementById('save-simulation-btn').addEventListener('click', handleSaveSandbox);
        document.getElementById('load-simulation-btn').addEventListener('click', openLoadSimulationModal);
        document.getElementById('close-simulation-modal-btn').addEventListener('click', () => document.getElementById('load-simulation-modal').classList.add('hidden'));
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

    async function fetchAndSetLatestPlanningData(forceReload = false) {
        const cacheKey = 'otimizacaoSetupCache';
        if (!forceReload) {
            const cachedData = sessionStorage.getItem(cacheKey);
            if (cachedData) {
                console.log("Carregando dados de otimização do cache da sessão.");
                dadosOriginais = JSON.parse(cachedData);
                return true;
            }
        }

        console.log("Buscando dados de otimização do servidor.");
        try {
            const response = await fetch('/api/gantt/obter_ultimo_planejamento');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Nenhum planejamento encontrado no histórico');
            }
            dadosOriginais = result.ultimo_planejamento;

            // Salva no cache para uso futuro na mesma sessão
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify(dadosOriginais));
            } catch (e) {
                console.warn("Não foi possível salvar os dados de otimização no cache: " + e.name);
            }

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

    async function loadOtimizacaoData(forceReload = false) {
        showLoading();
        if (forceReload) {
            sessionStorage.removeItem('otimizacaoSetupCache');
            console.log("Cache de otimização limpo para forçar recarregamento.");
        }
        const success = await fetchAndSetLatestPlanningData(forceReload);
        if (success && dadosOriginais) {
            renderOtimizacaoSetupTable(dadosOriginais.programacao_data);
            document.getElementById('reset-simulation-btn').classList.remove('hidden');
            document.getElementById('save-simulation-btn').classList.remove('hidden');
            document.getElementById('simulation-mode-notice').classList.remove('hidden');
        } else if (!forceReload) {
            // Se não for reload forçado e não houver sucesso (nem cache), não mostra erro, apenas fica quieto.
            // O usuário pode carregar manualmente se quiser.
            console.log("Nenhum dado de otimização no cache. Aguardando ação do usuário.");
        }
        hideLoading();
    }

    function renderOtimizacaoSetupTable(programacaoData) {
        const container = document.getElementById('otimizacao-setup-container');
        const kpiContainer = document.getElementById('otimizacao-kpi-container');

        container.innerHTML = '';

        if (!programacaoData || programacaoData.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-8 md:col-span-2">Não há dados de programação para exibir.</p>';
            kpiContainer.classList.add('hidden');
            return;
        }

        kpiContainer.classList.remove('hidden');

        const stockOrderIds = { min: "9999997", med: "9999998", max: "9999999" };
        const allStockIds = Object.values(stockOrderIds);

        const firstUseByMold = {};
        programacaoData.forEach(item => {
            const mold = item.Produto;
            const round = item["Número da Rodada"];
            if (!firstUseByMold[mold] || round < firstUseByMold[mold].round) {
                firstUseByMold[mold] = { round: round, order: String(item.Pedido) };
            }
        });

        let countPedidos = 0, countEstoqueMin = 0, countEstoqueMed = 0, countEstoqueMax = 0;
        const processedMolds = new Set();

        programacaoData.forEach(item => {
            const mold = item.Produto;
            const round = item["Número da Rodada"];
            const quantity = item["Quantidade de Moldes"] || 0;
            const firstUse = firstUseByMold[mold];

            if (firstUse && round === firstUse.round && !processedMolds.has(mold)) {
                if (firstUse.order === stockOrderIds.min) countEstoqueMin += quantity;
                else if (firstUse.order === stockOrderIds.med) countEstoqueMed += quantity;
                else if (firstUse.order === stockOrderIds.max) countEstoqueMax += quantity;
                else if (!allStockIds.includes(firstUse.order)) countPedidos += quantity;
                processedMolds.add(mold);
            }
        });

        document.getElementById('otimizacao-kpi-pedidos').textContent = countPedidos;
        document.getElementById('otimizacao-kpi-estoque-min').textContent = countEstoqueMin;
        document.getElementById('otimizacao-kpi-estoque-med').textContent = countEstoqueMed;
        document.getElementById('otimizacao-kpi-estoque-max').textContent = countEstoqueMax;

        const stockTypeMap = { "9999997": "Estoque Mínimo", "9999998": "Estoque Médio", "9999999": "Estoque Máximo" };

        const setupByArm = programacaoData.reduce((acc, item) => {
            const arm = item.Braço;
            const mold = item.Produto;
            const order = String(item.Pedido);
            const quantity = item["Quantidade de Moldes"];

            if (!acc[arm]) acc[arm] = {};
            if (!acc[arm][mold]) {
                acc[arm][mold] = { producingFor: new Set(), quantity: quantity };
            }
            acc[arm][mold].producingFor.add(stockTypeMap[order] || `Pedido Cliente`);
            acc[arm][mold].quantity = quantity;
            return acc;
        }, {});

        for (let i = 1; i <= 6; i++) {
            const armCard = document.createElement('div');
            armCard.className = 'arm-card bg-primary-dark rounded-lg p-4 flex flex-col h-full shadow-lg';
            armCard.dataset.armId = i;

            const moldsInArm = setupByArm[i];
            let totalMoldesNoBraco = moldsInArm ? Object.values(moldsInArm).reduce((sum, moldData) => sum + (moldData.quantity || 0), 0) : 0;

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
                    const producingForBadges = [...new Set(Array.from(moldData.producingFor))].map(p => {
                        if (p.startsWith('Pedido')) return `<span class="inline-block bg-accent text-white text-xs font-semibold mr-1 mb-1 px-2 py-0.5 rounded-full">Pedido</span>`;
                        if (p === "Estoque Mínimo") return `<span class="inline-block bg-yellow-500 text-black text-xs font-semibold mr-1 mb-1 px-2 py-0.5 rounded-full">MIN</span>`;
                        if (p === "Estoque Médio") return `<span class="inline-block bg-green-500 text-white text-xs font-semibold mr-1 mb-1 px-2 py-0.5 rounded-full">MED</span>`;
                        if (p === "Estoque Máximo") return `<span class="inline-block bg-red-500 text-white text-xs font-semibold mr-1 mb-1 px-2 py-0.5 rounded-full">MAX</span>`;
                        return '';
                    }).join('');

                    tableHtml += `
                        <tr class="mold-row border-b border-gray-700" draggable="true" id="mold-row-${i}-${mold.replace(/[^a-zA-Z0-9]/g, '-')}" data-mold-name="${mold}">
                            <td class="px-4 py-2 font-semibold truncate" title="${mold}">${mold}</td>
                            <td class="px-4 py-2 text-center font-mono">${moldData.quantity}</td>
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

        setupDragAndDrop();
    }

    function setupDragAndDrop() {
        const draggableRows = document.querySelectorAll('.mold-row');
        const dropZones = document.querySelectorAll('.arm-card');

        draggableRows.forEach(row => {
            row.addEventListener('dragstart', e => {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.id);
            });
            row.addEventListener('dragend', e => e.target.classList.remove('dragging'));
        });

        dropZones.forEach(zone => {
            zone.addEventListener('dragover', e => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', e => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                const id = e.dataTransfer.getData('text/plain');
                const draggableElement = document.getElementById(id);
                const dropzoneTbody = zone.querySelector('tbody');
                if (draggableElement && dropzoneTbody) {
                    const emptyMessageRow = dropzoneTbody.querySelector('td[colspan="3"]');
                    if (emptyMessageRow) emptyMessageRow.parentElement.remove();
                    dropzoneTbody.appendChild(draggableElement);
                }
            });
        });
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
        if (!description) return;

        showLoading();

        try {
            const newMoldLocations = {};
            document.querySelectorAll('.arm-card').forEach(card => {
                const armId = parseInt(card.dataset.armId, 10);
                card.querySelectorAll('.mold-row').forEach(row => {
                    const moldName = row.dataset.moldName;
                    if (moldName) newMoldLocations[moldName] = armId;
                });
            });

            const novoPlanejamento = JSON.parse(JSON.stringify(dadosOriginais));
            novoPlanejamento.programacao_data.forEach(item => {
                const currentMold = item.Produto;
                if (newMoldLocations.hasOwnProperty(currentMold)) {
                    item.Braço = newMoldLocations[currentMold];
                }
            });

            novoPlanejamento.timestamp = new Date().toISOString();
            novoPlanejamento.tipo = 'Simulação de Setup';
            novoPlanejamento.descricao = description;
            delete novoPlanejamento._id;

            const response = await fetch('/api/gantt/salvar_planejamento_alternativo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novoPlanejamento)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao salvar a simulação.');

            alert(result.message);

        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    async function openLoadSimulationModal() {
        const modal = document.getElementById('load-simulation-modal');
        const container = document.getElementById('simulation-list-container');
        container.innerHTML = '<p class="text-secondary text-center py-8">Carregando simulações salvas...</p>';
        modal.classList.remove('hidden');

        try {
            const response = await fetch('/api/gantt/listar_simulacoes');
            const result = await response.json();

            if (!response.ok) throw new Error(result.error || 'Erro ao buscar simulações.');

            if (result.simulacoes && result.simulacoes.length > 0) {
                container.innerHTML = '';
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
                                <i class="fas fa-download mr-2"></i>Carregar
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
            if (!response.ok) throw new Error(result.error || 'Simulação não encontrada');

            dadosOriginais = result;
            renderOtimizacaoSetupTable(result.programacao_data);

            document.getElementById('reset-simulation-btn').classList.remove('hidden');
            document.getElementById('save-simulation-btn').classList.remove('hidden');
            document.getElementById('simulation-mode-notice').classList.remove('hidden');

            modal.classList.add('hidden');
            alert(`Simulação "${result.descricao || result._id}" carregada com sucesso!`);
        } catch (error) {
            alert(`Erro ao carregar simulação: ${error.message}`);
        } finally {
            hideLoading();
        }
    };

    window.deleteSimulation = async function (simulationId, buttonElement) {
        if (!confirm('Tem certeza que deseja excluir esta simulação? Esta ação não pode ser desfeita.')) return;

        showLoading();
        try {
            const response = await fetch(`/api/gantt/excluir_planejamento/${simulationId}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao excluir simulação');

            alert(result.message);
            const itemDiv = buttonElement.closest('.flex.items-center.justify-between');
            if (itemDiv) itemDiv.remove();
        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            hideLoading();
        }
    };
});