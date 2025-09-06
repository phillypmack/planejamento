document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let dadosOriginais = null;

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

        // --- Início do Depurador ---
        console.groupCollapsed("Depuração: Sugestões de Otimização");
        console.log("Dados de entrada para a função:", JSON.parse(JSON.stringify(data)));

        // --- Etapa 1: Identificar Recursos Disponíveis (Slots para troca) ---
        console.log("--- Etapa 1: Identificando Recursos Disponíveis ---");
        // Prioridade 1: Moldes que já estão instalados mas estão ociosos.
        const idleMoldCandidates = (data.moldes_ociosos_data || []).map(item => ({
            produto: item.Nome,
            braco: item.Braço,
            tipo: 'Ocioso'
        }))
            // Garante unicidade, caso um molde ocioso apareça mais de uma vez.
            .filter((item, index, self) => index === self.findIndex(t => t.produto === item.produto && t.braco === item.braco));
        console.log("Candidatos à Remoção (Ociosos):", idleMoldCandidates);

        // Prioridade 2: Moldes produzindo para estoque não essencial (Médio e Máximo).
        const removableStockOrderIds = ["9999998", "9999999"]; // ESTOQUE MED e MAX
        const stockMoldCandidates = (data.programacao_data || [])
            .filter(item => removableStockOrderIds.includes(String(item.Pedido)))
            .map(item => ({
                produto: item.Produto,
                braco: item.Braço,
                tipo: String(item.Pedido) === "9999998" ? "Estoque Médio" : "Estoque Máximo"
            }))
            .filter((item, index, self) => index === self.findIndex(t => t.produto === item.produto && t.braco === item.braco));
        console.log("Candidatos à Remoção (Estoque MED/MAX):", stockMoldCandidates);

        // Combina os candidatos em uma lista priorizada (ociosos primeiro).
        const removalCandidates = [...idleMoldCandidates, ...stockMoldCandidates];
        console.log("Lista Final de Candidatos à Remoção (Priorizada):", removalCandidates);

        // --- Etapa 2: Identificar Necessidades (Pedidos de clientes esperando por moldes) ---
        console.log("--- Etapa 2: Identificando Necessidades ---");
        const necessidadeSemMoldesParaOtimizacao = (data.necessidade_sem_moldes_data || []).map(item => ({
            Pedido: item.Pedido,
            Produto: item.Produto || item.Nome,
            Quantidade: item.Quantidade,
            "Qtd. Moldes Cadastrados": item["Qtd. Moldes Cadastrados"]
        }));
        console.log("Necessidades Brutas (antes de filtrar):", necessidadeSemMoldesParaOtimizacao);

        const stockOrderIds = ["9999997", "9999998", "9999999"];
        const installationCandidates = necessidadeSemMoldesParaOtimizacao
            .filter(item => item["Qtd. Moldes Cadastrados"] > 0)
            .filter(item => item.Pedido && !stockOrderIds.includes(String(parseInt(item.Pedido))))
            .sort((a, b) => b.Quantidade - a.Quantidade);

        console.log("Candidatos à Instalação (Necessidades de Clientes):", installationCandidates);

        // --- Etapa 3: Gerar Sugestões ---
        console.log("--- Etapa 3: Gerando Sugestões (Pareamento) ---");
        if (removalCandidates.length === 0 || installationCandidates.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center">Nenhuma sugestão de otimização encontrada.</p>';
            console.warn("Nenhuma sugestão gerada. Motivo: Lista de remoção ou instalação está vazia.");
            console.log("Tamanho da lista de remoção:", removalCandidates.length);
            console.log("Tamanho da lista de instalação:", installationCandidates.length);
            console.groupEnd(); // Fim do Depurador
            return;
        }

        const suggestions = [];
        const usedRemovalSlots = new Set(); // Controla os slots de remoção já sugeridos
        const usedInstallationProducts = new Set(); // Controla as necessidades já atendidas por uma sugestão

        // Itera sobre as necessidades (demandas)
        for (const installation of installationCandidates) {
            console.group(`Processando Necessidade: ${installation.Produto}`);
            if (usedInstallationProducts.has(installation.Produto)) {
                console.log("Produto já atendido por outra sugestão. Pulando.");
                console.groupEnd();
                continue; // Pula se já existe uma sugestão para este produto.
            }

            // Encontra o melhor recurso (slot) disponível para esta necessidade
            const removal = removalCandidates.find(rem =>
                !usedRemovalSlots.has(`${rem.braco}-${rem.produto}`) && // O slot ainda não foi usado em outra sugestão
                rem.produto !== installation.Produto // Garante que não estamos sugerindo trocar um molde por ele mesmo
            );

            if (removal) {
                console.log("Recurso encontrado para troca:", removal);
                suggestions.push({ remover: removal, instalar: installation });
                usedInstallationProducts.add(installation.Produto);
                usedRemovalSlots.add(`${removal.braco}-${removal.produto}`);
            } else {
                console.warn("Nenhum recurso de remoção compatível encontrado para esta necessidade.");
            }
            console.groupEnd();
        }

        // --- Etapa 4: Exibir as Sugestões ---
        console.log("--- Etapa 4: Exibindo Resultados ---");
        console.log("Sugestões Finais Geradas:", suggestions);
        if (suggestions.length > 0) {
            suggestions.forEach(sug => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.className = 'bg-gray-800 p-4 rounded-lg border-l-4 border-blue-500';

                const removalText = sug.remover.tipo === 'Ocioso'
                    ? `remover o molde ocioso de <strong class="text-white">${sug.remover.produto}</strong>`
                    : `remover o molde de <strong class="text-white">${sug.remover.produto}</strong> (produzindo para ${sug.remover.tipo})`;

                suggestionDiv.innerHTML = `
                    <div class="flex items-start">
                        <div class="flex-shrink-0">
                            <i class="fas fa-lightbulb text-blue-400 text-xl"></i>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-gray-300">
                                Para atender a pedidos em espera, considere ${removalText}
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
            console.warn("O pareamento não resultou em nenhuma sugestão válida.");
        }
        console.groupEnd(); // Fim do Depurador
    }

    function showLoading() {
        document.getElementById('loading-layer').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('loading-layer').classList.add('hidden');
    }
});