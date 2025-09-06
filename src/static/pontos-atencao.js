document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let dadosOriginais = null;

    // Pagination state for "Pedidos Não Atendidos" table
    let pedidosNaoAtendidosData = [];
    let currentPagePedidos = 1;
    const itemsPerPagePedidos = 5; // 5 items per page

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        loadAttentionPointsData();
    }

    function setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
        // Reload button
        document.getElementById('reload-data-btn').addEventListener('click', loadAttentionPointsData);
        // Pagination listeners
        document.getElementById('pedidos-prev-page').addEventListener('click', () => {
            if (currentPagePedidos > 1) {
                currentPagePedidos--;
                renderPedidosNaoAtendidosPage();
            }
        });
        document.getElementById('pedidos-next-page').addEventListener('click', () => {
            const totalPages = Math.ceil(pedidosNaoAtendidosData.length / itemsPerPagePedidos);
            if (currentPagePedidos < totalPages) {
                currentPagePedidos++;
                renderPedidosNaoAtendidosPage();
            }
        });

        // Event delegation for expandable rows
        const pedidosTableBody = document.getElementById('pedidos-nao-atendidos-table').querySelector('tbody');
        pedidosTableBody.addEventListener('click', (e) => {
            const mainRow = e.target.closest('.main-row');
            if (mainRow) {
                const targetId = mainRow.dataset.targetId;
                const detailRow = document.getElementById(targetId);
                const icon = mainRow.querySelector('i.fas');

                detailRow.classList.toggle('hidden');
                mainRow.classList.toggle('bg-gray-700');
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

    async function loadAttentionPointsData() {
        showLoading();
        const success = await fetchAndSetLatestPlanningData();
        if (success) {
            renderAttentionPoints(dadosOriginais);
        } else {
            const errorMessage = '<tr><td colspan="4" class="text-center p-4 text-secondary">Não foi possível carregar os dados. Gere um novo planejamento.</td></tr>';
            document.getElementById('ociosos-table').querySelector('tbody').innerHTML = errorMessage;
            document.getElementById('necessidade-table').querySelector('tbody').innerHTML = errorMessage;
            document.getElementById('estoque-table').querySelector('tbody').innerHTML = errorMessage;
            document.getElementById('pedidos-nao-atendidos-table').querySelector('tbody').innerHTML = errorMessage;
            document.getElementById('sugestoes-otimizacao-container').innerHTML = '<p class="text-secondary text-center">Não foi possível carregar os dados.</p>';
        }
        hideLoading();
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
            console.error(`Erro ao buscar último planejamento: ${error.message}`);
            dadosOriginais = null;
            return false;
        }
    }

    function renderAttentionPoints(data) {
        fillAttentionTables(data);
        generateOptimizationSuggestions(data);
        fillPedidosNaoAtendidosTable(data);
    }

    function fillAttentionTables(data) {
        // Fill idle molds table
        const ociososTable = document.getElementById('ociosos-table').querySelector('tbody');
        ociososTable.innerHTML = '';
        if (data.moldes_ociosos_data && data.moldes_ociosos_data.length > 0) {
            data.moldes_ociosos_data.forEach(item => {
                const row = ociososTable.insertRow();
                row.innerHTML = `
                    <td class="px-4 py-2">${item.Nome}</td>
                    <td class="px-4 py-2">${item.Quantidade}</td>
                    <td class="px-4 py-2">${item["Rodada Ociosa"]}</td>
                    <td class="px-4 py-2">${item.Braço}</td>
                `;
            });
        } else {
            ociososTable.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-secondary">Nenhum molde ocioso encontrado.</td></tr>';
        }

        // Fill necessity table
        const necessidadeTable = document.getElementById('necessidade-table').querySelector('tbody');
        necessidadeTable.innerHTML = '';
        if (data.necessidade_sem_moldes_data && data.necessidade_sem_moldes_data.length > 0) {
            const necessidadeFiltrada = data.necessidade_sem_moldes_data.filter(item => item["Qtd. Moldes Cadastrados"] > 0);
            if (necessidadeFiltrada.length > 0) {
                const necessidadeAgrupada = necessidadeFiltrada.reduce((acc, item) => {
                    const produtoNome = item.Produto || item.Nome;
                    if (!acc[produtoNome]) {
                        acc[produtoNome] = { Produto: produtoNome, Quantidade: 0, "Qtd. Moldes Cadastrados": item["Qtd. Moldes Cadastrados"] };
                    }
                    acc[produtoNome].Quantidade += item.Quantidade;
                    return acc;
                }, {});
                const listaAgrupada = Object.values(necessidadeAgrupada).sort((a, b) => b.Quantidade - a.Quantidade);
                listaAgrupada.forEach(item => {
                    const row = necessidadeTable.insertRow();
                    row.innerHTML = `
                        <td class="px-4 py-2">${item.Produto}</td>
                        <td class="px-4 py-2">${item.Quantidade}</td>
                        <td class="px-4 py-2">${item["Qtd. Moldes Cadastrados"]}</td>
                    `;
                });
            } else {
                necessidadeTable.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-secondary">Nenhuma necessidade de molde não atendida.</td></tr>';
            }
        } else {
            necessidadeTable.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-secondary">Nenhuma necessidade de molde não atendida.</td></tr>';
        }

        // Fill stock production table
        const estoqueTable = document.getElementById('estoque-table').querySelector('tbody');
        estoqueTable.innerHTML = '';
        if (data.programacao_data && data.programacao_data.length > 0) {
            const stockOrderIds = ["9999997", "9999998", "9999999"];
            const stockTypeMap = { "9999997": "ESTOQUE MINI", "9999998": "ESTOQUE MED", "9999999": "ESTOQUE MAX" };
            const stockProductionData = data.programacao_data.filter(item => stockOrderIds.includes(String(item.Pedido)));

            if (stockProductionData.length > 0) {
                const groupedByProduct = stockProductionData.reduce((acc, item) => {
                    const produto = item.Produto;
                    if (!acc[produto]) {
                        acc[produto] = { totalQuantity: 0, stockTypes: new Set(), moundCountByArm: {} };
                    }
                    acc[produto].totalQuantity += item["Quantidade Programada"];
                    acc[produto].stockTypes.add(stockTypeMap[String(item.Pedido)]);
                    if (item.Braço && item["Quantidade de Moldes"] !== undefined) {
                        acc[produto].moundCountByArm[item.Braço] = item["Quantidade de Moldes"];
                    }
                    return acc;
                }, {});

                const sortedStockProduction = Object.entries(groupedByProduct)
                    .map(([produto, data]) => {
                        const armDetails = Object.entries(data.moundCountByArm).map(([arm, count]) => `Braço ${arm} (${count})`).join(', ');
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
                estoqueTable.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-secondary">Nenhum molde está produzindo para estoque.</td></tr>';
            }
        } else {
            estoqueTable.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-secondary">Nenhum dado de programação encontrado.</td></tr>';
        }
    }

    function generateOptimizationSuggestions(data) {
        const container = document.getElementById('sugestoes-otimizacao-container');
        container.innerHTML = '';

        const removableStockOrderIds = ["9999998", "9999999"];
        const removalCandidates = (data.programacao_data || [])
            .filter(item => removableStockOrderIds.includes(String(item.Pedido)))
            .map(item => ({
                produto: item.Produto,
                braco: item.Braço,
                tipoEstoque: String(item.Pedido) === "9999998" ? "Estoque Médio" : "Estoque Máximo"
            }))
            .filter((item, index, self) => index === self.findIndex(t => t.produto === item.produto && t.braco === item.braco));

        const necessidadeSemMoldesParaOtimizacao = (data.necessidade_sem_moldes_data || []).map(item => ({
            Pedido: item.Pedido,
            Produto: item.Produto || item.Nome,
            Quantidade: item.Quantidade,
            "Qtd. Moldes Cadastrados": item["Qtd. Moldes Cadastrados"]
        }));

        const stockOrderIds = ["9999997", "9999998", "9999999"];
        const installationCandidates = necessidadeSemMoldesParaOtimizacao
            .filter(item => item["Qtd. Moldes Cadastrados"] > 0)
            .filter(item => item.Pedido && !stockOrderIds.includes(String(parseInt(item.Pedido))))
            .sort((a, b) => b.Quantidade - a.Quantidade);

        if (removalCandidates.length === 0 || installationCandidates.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center">Nenhuma sugestão de otimização encontrada.</p>';
            return;
        }

        const suggestions = [];
        const usedInstallationCandidates = new Set();

        for (const removal of removalCandidates) {
            const installation = installationCandidates.find(inst => inst.Produto && !usedInstallationCandidates.has(inst.Produto));
            if (installation) {
                suggestions.push({ remover: removal, instalar: installation });
                usedInstallationCandidates.add(installation.Produto);
            }
        }

        if (suggestions.length > 0) {
            suggestions.forEach(sug => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.className = 'bg-gray-800 p-4 rounded-lg border-l-4 border-blue-500';
                suggestionDiv.innerHTML = `
                    <div class="flex items-start">
                        <div class="flex-shrink-0">
                            <i class="fas fa-lightbulb text-blue-400 text-xl"></i>
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
            container.innerHTML = '<p class="text-secondary text-center">Nenhuma sugestão de otimização encontrada.</p>';
        }
    }

    function showLoading() {
        document.getElementById('loading-layer').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('loading-layer').classList.add('hidden');
    }

    async function fillPedidosNaoAtendidosTable(data) {
        const tableBody = document.getElementById('pedidos-nao-atendidos-table').querySelector('tbody');
        const paginationControls = document.getElementById('pedidos-nao-atendidos-pagination');
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-secondary">Carregando detalhes dos pedidos...</td></tr>';
        paginationControls.classList.add('hidden'); // Hide pagination while loading

        const stockOrderIds = ["9999997", "9999998", "9999999"];
        const necessidades = (data.necessidade_sem_moldes_data || [])
            .filter(item => item["Qtd. Moldes Cadastrados"] > 0 && !stockOrderIds.includes(String(item.Pedido)));

        if (necessidades.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-secondary">Nenhum pedido com necessidade não atendida encontrado.</td></tr>';
            pedidosNaoAtendidosData = [];
            paginationControls.classList.add('hidden');
            return;
        }

        const pedidosAgrupados = necessidades.reduce((acc, necessidade) => {
            const pedidoId = String(parseInt(necessidade.Pedido)); // Normalize pedido ID
            if (!acc[pedidoId]) {
                acc[pedidoId] = { itens: [], detalhes: null };
            }
            acc[pedidoId].itens.push(necessidade);
            return acc;
        }, {});

        // Fetch details for all unique orders in parallel
        const promises = Object.keys(pedidosAgrupados).map(async (pedidoId) => {
            try {
                const response = await fetch(`/api/gantt/detalhes_pedido/${pedidoId}`);
                if (response.ok) {
                    pedidosAgrupados[pedidoId].detalhes = await response.json();
                }
            } catch (error) {
                console.error(`Erro ao buscar detalhes para o pedido ${pedidoId}:`, error);
            }
        });

        await Promise.all(promises);

        // Group data by order for expandable rows, and sort by order value
        pedidosNaoAtendidosData = Object.entries(pedidosAgrupados)
            .filter(([, info]) => info.detalhes) // Only include orders for which we got details
            .map(([pedidoId, info]) => ({
                pedidoId: pedidoId,
                cliente: info.detalhes.cliente,
                valorPedido: info.detalhes.valor,
                itens: info.itens.sort((a, b) => (a.Produto || a.Nome).localeCompare(b.Produto || b.Nome)) // Sort items alphabetically
            }))
            .sort((a, b) => b.valorPedido - a.valorPedido);


        if (pedidosNaoAtendidosData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-secondary">Não foi possível carregar os detalhes dos pedidos.</td></tr>';
            paginationControls.classList.add('hidden');
            return;
        }

        // Render the first page
        currentPagePedidos = 1;
        renderPedidosNaoAtendidosPage();
    }

    function renderPedidosNaoAtendidosPage() {
        const tableBody = document.getElementById('pedidos-nao-atendidos-table').querySelector('tbody');
        const paginationControls = document.getElementById('pedidos-nao-atendidos-pagination');
        const pageInfo = document.getElementById('pedidos-page-info');
        const prevButton = document.getElementById('pedidos-prev-page');
        const nextButton = document.getElementById('pedidos-next-page');

        tableBody.innerHTML = '';

        const totalPages = Math.ceil(pedidosNaoAtendidosData.length / itemsPerPagePedidos);
        const start = (currentPagePedidos - 1) * itemsPerPagePedidos;
        const end = start + itemsPerPagePedidos;
        const pageData = pedidosNaoAtendidosData.slice(start, end);

        pageData.forEach(order => {
            const detailRowId = `details-for-pedido-${order.pedidoId}`;

            const mainRowHtml = `
                <tr class="main-row border-b border-gray-700 hover:bg-gray-700 cursor-pointer" data-target-id="${detailRowId}">
                    <td class="px-4 py-3 text-center text-secondary"><i class="fas fa-chevron-down transition-transform"></i></td>
                    <td class="px-4 py-3 font-semibold">${order.pedidoId}</td>
                    <td class="px-4 py-3">${order.cliente}</td>
                    <td class="px-4 py-3 text-right font-mono">${order.valorPedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>
            `;

            const detailRowHtml = `
                <tr id="${detailRowId}" class="detail-row hidden">
                    <td colspan="4" class="p-0 detail-row-cell">
                        <div class="p-4">
                            <table class="min-w-full text-xs">
                                <thead class="text-gray-400">
                                    <tr>
                                        <th class="px-3 py-2 text-left">Produto</th>
                                        <th class="px-3 py-2 text-left">Cor</th>
                                        <th class="px-3 py-2 text-right">Qtd. Faltante</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.itens.map(item => `
                                        <tr class="border-t border-gray-700">
                                            <td class="px-3 py-2">${item.Produto || item.Nome}</td>
                                            <td class="px-3 py-2">${item.Cor || '-'}</td>
                                            <td class="px-3 py-2 text-right font-mono">${item.Quantidade.toLocaleString('pt-BR')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += mainRowHtml + detailRowHtml;
        });

        // Update pagination controls
        if (totalPages > 1) {
            paginationControls.classList.remove('hidden');
            pageInfo.textContent = `Página ${currentPagePedidos} de ${totalPages}`;
            prevButton.disabled = currentPagePedidos === 1;
            nextButton.disabled = currentPagePedidos === totalPages;
        } else {
            paginationControls.classList.add('hidden');
        }
    }
});