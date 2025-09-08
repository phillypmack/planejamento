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
        displayActivePlanBanner();
        loadAttentionPointsData(); // Carrega os dados, usando o cache se disponível
    }

    function setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
        // Reload button
        document.getElementById('reload-data-btn').addEventListener('click', () => loadAttentionPointsData(true));
        // Pagination listeners
        document.getElementById('pedidos-prev-page').addEventListener('click', async () => {
            if (currentPagePedidos > 1) {
                currentPagePedidos--;
                showLoading();
                await renderPedidosNaoAtendidosPage();
                hideLoading();
            }
        });
        document.getElementById('pedidos-next-page').addEventListener('click', async () => {
            const totalPages = Math.ceil(pedidosNaoAtendidosData.length / itemsPerPagePedidos);
            if (currentPagePedidos < totalPages) {
                currentPagePedidos++;
                showLoading();
                await renderPedidosNaoAtendidosPage();
                hideLoading();
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

        // Add new listener for the necessity filter
        document.querySelectorAll('input[name="necessidade-filter"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (dadosOriginais) {
                    fillAttentionTables(dadosOriginais);
                }
            });
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

    async function loadAttentionPointsData(forceReload = false) {
        showLoading();
        if (forceReload) {
            // Limpa ambos os caches para garantir que todos os dados sejam recarregados do servidor.
            sessionStorage.removeItem('attentionPointsCache');
            sessionStorage.removeItem('orderDetailsCache');
            console.log("Caches de pontos de atenção e detalhes de pedidos limpos para forçar recarregamento.");
        }
        const success = await fetchAndSetLatestPlanningData();
        if (success) {
            await renderAttentionPoints(dadosOriginais);
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
        // Utiliza a nova função compartilhada para buscar os dados corretos
        // O cache é gerenciado dentro da função fetchActivePlanningData se necessário no futuro.
        dadosOriginais = await fetchActivePlanningData();
        return dadosOriginais !== null;
    }

    async function renderAttentionPoints(data) {
        fillAttentionTables(data);
        generateOptimizationSuggestions(data);
        await fillPedidosNaoAtendidosTable(data);
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
            // Get the current filter value
            const filterValue = document.querySelector('input[name="necessidade-filter"]:checked').value;
            const stockOrderIds = ["9999997", "9999998", "9999999"];

            let necessidadeComMoldes = data.necessidade_sem_moldes_data.filter(item => item["Qtd. Moldes Cadastrados"] > 0);

            // Apply the new filter
            let necessidadeFiltrada;
            if (filterValue === 'pedidos') {
                necessidadeFiltrada = necessidadeComMoldes.filter(item => !stockOrderIds.includes(String(item.Pedido)));
            } else if (filterValue === 'estoque') {
                necessidadeFiltrada = necessidadeComMoldes.filter(item => stockOrderIds.includes(String(item.Pedido)));
            } else { // 'todos'
                necessidadeFiltrada = necessidadeComMoldes;
            }

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
                necessidadeTable.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-secondary">Nenhuma necessidade encontrada para o filtro selecionado.</td></tr>';
            }
        } else {
            necessidadeTable.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-secondary">Nenhum dado de necessidade não atendida.</td></tr>';
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
        document.getElementById('top-loading-bar').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('top-loading-bar').classList.add('hidden');
    }

    async function fillPedidosNaoAtendidosTable(data) {
        const tableBody = document.getElementById('pedidos-nao-atendidos-table').querySelector('tbody');
        const paginationControls = document.getElementById('pedidos-nao-atendidos-pagination');
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-secondary">Analisando pedidos...</td></tr>';
        paginationControls.classList.add('hidden'); // Hide pagination while loading

        // Carrega o cache de detalhes de pedidos da sessão
        const orderDetailsCache = JSON.parse(sessionStorage.getItem('orderDetailsCache')) || {};

        const stockOrderIds = ["9999997", "9999998", "9999999"]; // Pedidos de estoque
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
                const cachedDetails = orderDetailsCache[pedidoId];
                acc[pedidoId] = {
                    itens: [],
                    cliente: cachedDetails ? cachedDetails.cliente : null,
                    valorPedido: cachedDetails ? cachedDetails.valor : null
                };
            }
            acc[pedidoId].itens.push(necessidade);
            return acc;
        }, {});

        // Mapeia os dados para a estrutura final, mas sem os detalhes de cliente/valor ainda.
        // Ordena por ID do pedido para uma lista inicial consistente.
        pedidosNaoAtendidosData = Object.entries(pedidosAgrupados)
            .map(([pedidoId, data]) => ({
                pedidoId: pedidoId,
                cliente: data.cliente, // será null inicialmente
                valorPedido: data.valorPedido, // será null inicialmente
                itens: data.itens.sort((a, b) => (a.Produto || a.Nome).localeCompare(b.Produto || b.Nome))
            }))
            .sort((a, b) => parseInt(a.pedidoId) - parseInt(b.pedidoId));

        // Render the first page
        currentPagePedidos = 1;
        await renderPedidosNaoAtendidosPage();
    }

    async function renderPedidosNaoAtendidosPage() {
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

        // Identifica quais pedidos na página atual ainda não têm detalhes carregados.
        const pedidosParaBuscar = pageData.filter(p => p.cliente === null);

        if (pedidosParaBuscar.length > 0) {
            // Carrega o cache para atualizá-lo com os novos dados
            const orderDetailsCache = JSON.parse(sessionStorage.getItem('orderDetailsCache')) || {};

            const promises = pedidosParaBuscar.map(async (pedido) => {
                try {
                    const response = await fetch(`/api/gantt/detalhes_pedido/${pedido.pedidoId}`);
                    if (response.ok) {
                        const detalhes = await response.json();
                        // Atualiza o item no array principal (pedidosNaoAtendidosData) para cache
                        const originalItem = pedidosNaoAtendidosData.find(p => p.pedidoId === pedido.pedidoId);
                        if (originalItem) {
                            originalItem.cliente = detalhes.cliente;
                            originalItem.valorPedido = detalhes.valor;
                            // Salva os detalhes recém-buscados no cache
                            orderDetailsCache[pedido.pedidoId] = { cliente: detalhes.cliente, valor: detalhes.valor };
                        }
                    }
                } catch (error) {
                    console.error(`Erro ao buscar detalhes para o pedido ${pedido.pedidoId}:`, error);
                    // Deixa os detalhes como null para que possa tentar novamente
                }
            });
            await Promise.all(promises);

            // Salva o cache atualizado de volta no sessionStorage
            sessionStorage.setItem('orderDetailsCache', JSON.stringify(orderDetailsCache));
        }

        // Após buscar os detalhes, reordena a lista completa pelo valor do pedido (decrescente)
        // Apenas se todos os detalhes já foram carregados para evitar ordenação inconsistente.
        const allDetailsLoaded = pedidosNaoAtendidosData.every(p => p.cliente !== null);
        if (allDetailsLoaded) {
            pedidosNaoAtendidosData.sort((a, b) => b.valorPedido - a.valorPedido);
        }

        // Pega os dados da página novamente após a possível reordenação
        const finalPageData = pedidosNaoAtendidosData.slice(start, end);

        finalPageData.forEach(order => {
            const detailRowId = `details-for-pedido-${order.pedidoId}`;

            const mainRowHtml = `
                <tr class="main-row border-b border-gray-700 hover:bg-gray-700 cursor-pointer" data-target-id="${detailRowId}">
                    <td class="px-4 py-3 text-center text-secondary"><i class="fas fa-chevron-down transition-transform"></i></td>
                    <td class="px-4 py-3 font-semibold">${order.pedidoId}</td>
                    <td class="px-4 py-3">${order.cliente || '<i class="fas fa-spinner fa-spin"></i>'}</td>
                    <td class="px-4 py-3 text-right font-mono">${order.valorPedido !== null ? order.valorPedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Carregando...'}</td>
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