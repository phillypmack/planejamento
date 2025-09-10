/**
 * shared.js
 * Contém funções utilitárias compartilhadas entre as diferentes páginas do sistema.
 */

/**
 * Busca os dados do planejamento ativo.
 * Verifica se um 'activePlanId' está definido no sessionStorage.
 * Se estiver, busca esse planejamento específico.
 * Caso contrário, busca o último planejamento gerado.
 * 
 * @param {boolean} forceReload - Se true, ignora o cache de dados do planejamento.
 * @returns {Promise<object|null>} O objeto de dados do planejamento ou null em caso de erro.
 */
async function fetchActivePlanningData(forceReload = false) {
    const activePlanId = sessionStorage.getItem('activePlanId');
    let endpoint = '/api/gantt/obter_ultimo_planejamento';
    let resultKey = 'ultimo_planejamento';

    if (activePlanId) {
        console.log(`Carregando planejamento ativo do histórico: ${activePlanId}`);
        endpoint = `/api/gantt/obter_planejamento/${activePlanId}`;
        resultKey = 'planejamento'; // A API de busca por ID retorna o objeto diretamente
    } else {
        console.log("Carregando último planejamento gerado.");
    }

    try {
        const response = await fetch(endpoint);
        const result = await response.json();

        if (!response.ok) throw new Error(result.error || 'Erro ao buscar dados do planejamento.');

        return resultKey === 'planejamento' ? result : result[resultKey];
    } catch (error) {
        console.error(`Erro ao buscar dados do planejamento: ${error.message}`);
        return null;
    }
}

/**
 * Limpa a análise histórica ativa do sessionStorage e recarrega a página.
 */
function clearActivePlan() {
    sessionStorage.removeItem('activePlanId');
    sessionStorage.removeItem('activePlanDescription');
    window.location.reload();
}

/**
 * Exibe uma notificação no canto superior direito da página se uma análise histórica estiver ativa.
 */
function displayActivePlanBanner() {
    const activePlanId = sessionStorage.getItem('activePlanId');
    const activePlanDescription = sessionStorage.getItem('activePlanDescription');
    const targetElement = document.body; // Anexar ao body para posicionamento 'fixed'

    if (activePlanId && activePlanDescription && targetElement) {
        const existingBanner = document.getElementById('active-plan-banner');
        if (existingBanner) {
            existingBanner.remove();
        }

        const banner = document.createElement('div');
        banner.id = 'active-plan-banner';
        banner.className = 'fixed top-5 right-5 bg-yellow-400 border-l-4 border-yellow-600 text-black p-4 rounded-md shadow-lg z-50 w-full max-w-sm';

        banner.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0 pt-0.5">
                    <i class="fas fa-history text-xl text-yellow-800"></i>
                </div>
                <div class="ml-3 w-0 flex-1">
                    <p class="text-sm font-bold text-gray-900">Análise Histórica Ativa</p>
                    <p class="mt-1 text-xs text-gray-800">${activePlanDescription}</p>
                    <div class="mt-3">
                        <button onclick="clearActivePlan()" class="bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold py-1 px-3 rounded-full transition-colors duration-200">Voltar ao Planejamento Atual</button>
                    </div>
                </div>
            </div>
        `;

        targetElement.appendChild(banner);
    }
}

// --- AI Chat Functions (Global) ---

let chatHistory = []; // Histórico da conversa com a IA

/**
 * Inicializa os event listeners para o chat de IA.
 * Deve ser chamada no `initializeApp` de cada página que terá o chat.
 */
function initializeAIChat() {
    // Configura o modal flutuante da página do assistente de IA
    const aiIcon = document.getElementById('ai-chat-icon');
    const aiModalCloseBtn = document.getElementById('ai-assistant-page-close-btn');

    if (aiIcon) aiIcon.addEventListener('click', openAIAssistantPageModal);
    if (aiModalCloseBtn) aiModalCloseBtn.addEventListener('click', closeAIAssistantPageModal);
}

function openAIAssistantPageModal() {
    const modal = document.getElementById('ai-assistant-page-modal');
    const iframe = document.getElementById('ai-assistant-iframe');
    if (modal && iframe) {
        // Define o src apenas ao abrir para carregar/recarregar a página
        if (iframe.src !== iframe.dataset.src) {
            iframe.src = iframe.dataset.src;
        }
        modal.classList.remove('hidden');
    }
}

function closeAIAssistantPageModal() {
    const modal = document.getElementById('ai-assistant-page-modal');
    const iframe = document.getElementById('ai-assistant-iframe');
    if (modal && iframe) {
        modal.classList.add('hidden');
        // Reseta o src para interromper qualquer processamento dentro do iframe e liberar memória
        iframe.src = 'about:blank';
    }
}

function appendMessage(message, sender) {
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    const isAI = sender === 'ai';

    messageDiv.className = `flex items-start gap-3 ${isAI ? '' : 'flex-row-reverse'}`;

    const iconClass = isAI ? 'fa-brain text-accent' : 'fa-user text-green-400';
    const textBg = isAI ? 'bg-gray-700' : 'bg-green-900 bg-opacity-50';

    // Sanitize message to prevent HTML injection
    const textNode = document.createTextNode(message);
    const p = document.createElement('p');
    p.appendChild(textNode);

    messageDiv.innerHTML = `
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary-dark flex items-center justify-center">
            <i class="fas ${iconClass}"></i>
        </div>
        <div class="text-white p-3 rounded-lg ${textBg} max-w-md break-words">
            ${p.innerHTML.replace(/\n/g, '<br>')}
        </div>
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Adiciona a mensagem ao histórico para manter o contexto da conversa
    const role = isAI ? 'model' : 'user';
    // Evita adicionar mensagens de erro ou vazias ao histórico de contexto da IA
    if (message && !message.toLowerCase().startsWith('erro:')) {
        chatHistory.push({ role: role, parts: [{ text: message }] });
    }
}

function appendSuggestions(suggestions) {
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (!messagesContainer) return;

    const suggestionsHtml = suggestions.map(q =>
        // Sanitize question before putting it in HTML
        `<button class="suggestion-btn bg-accent hover:bg-accent-dark text-white text-sm font-semibold py-2 px-3 rounded-lg transition-colors duration-200 text-left">
            ${q.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </button>`
    ).join('');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex items-start gap-3';
    messageDiv.innerHTML = `
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary-dark flex items-center justify-center">
            <i class="fas fa-brain text-accent"></i>
        </div>
        <div class="text-white p-3 rounded-lg bg-gray-700 max-w-md">
            <p class="mb-3 font-semibold">Encontrei alguns pontos que podem ser do seu interesse. Clique em uma pergunta para começar:</p>
            <div class="flex flex-col items-start gap-2">
                ${suggestionsHtml}
            </div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Add event listeners to the new buttons
    messageDiv.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.textContent.trim();
            document.getElementById('ai-chat-input').value = question;
            sendChatMessage();
        });
    });
}

function appendOptimizationSuggestion(suggestion) {
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex items-start gap-3';
    messageDiv.innerHTML = `
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary-dark flex items-center justify-center">
            <i class="fas fa-lightbulb text-yellow-400"></i>
        </div>
        <div class="text-white p-3 rounded-lg bg-gray-700 max-w-md">
            <p class="mb-2 font-semibold text-yellow-400">${suggestion.title.replace(/</g, "&lt;")}</p>
            <p class="text-sm">${suggestion.description.replace(/</g, "&lt;")}</p>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (!messagesContainer) return;

    const typingDiv = document.createElement('div');
    typingDiv.id = 'ai-typing-indicator';
    typingDiv.className = 'flex items-start gap-3';
    typingDiv.innerHTML = `
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary-dark flex items-center justify-center">
            <i class="fas fa-brain text-accent"></i>
        </div>
        <div class="text-white p-3 rounded-lg bg-gray-700">
            <i class="fas fa-spinner fa-pulse"></i> Digitand...
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('ai-typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('ai-chat-input');
    const message = input.value.trim();

    if (!message) return;

    appendMessage(message, 'user');
    input.value = '';
    showTypingIndicator();

    try {
        // O histórico enviado para a API não deve incluir a mensagem atual do usuário
        const historyForAPI = chatHistory.slice(0, -1);
        const context = await buildSystemContext();
        const response = await fetch('/api/gantt/chat_gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, context, history: historyForAPI })
        });

        removeTypingIndicator();

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || 'Ocorreu um erro na comunicação com a IA.');
        }

        const result = await response.json();
        appendMessage(result.reply, 'ai');

    } catch (error) {
        removeTypingIndicator();
        // Remove a mensagem do usuário do histórico se a API falhar, para evitar poluir o contexto
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
            chatHistory.pop();
        }
        appendMessage(`Erro: ${error.message}`, 'ai');
    }
}

async function buildSystemContext() {
    const planningData = await fetchActivePlanningData(); // From shared.js

    if (!planningData) {
        return "Nenhum planejamento está carregado no momento. Informe ao usuário que ele precisa gerar ou carregar um planejamento para que você possa analisá-lo.";
    }

    const stockOrderIds = ["9999997", "9999998", "9999999"];
    const progData = planningData.programacao_data || [];
    const ociososData = planningData.moldes_ociosos_data || [];
    const inventarioData = planningData.inventario_moldes_data || [];
    const necessidadeData = planningData.necessidade_sem_moldes_data || [];

    const totalPedidos = progData.length > 0 ? new Set(progData.map(p => p.Pedido)).size : 0;
    const itensPedidos = progData.filter(p => !stockOrderIds.includes(String(p.Pedido))).reduce((sum, p) => sum + p['Quantidade Programada'], 0);
    const itensEstoque = progData.filter(p => stockOrderIds.includes(String(p.Pedido))).reduce((sum, p) => sum + p['Quantidade Programada'], 0);
    const skusNaoPlanejados = necessidadeData.filter(n => n['Qtd. Moldes Cadastrados'] > 0).length;
    const moldesOciosos = ociososData.length;

    // --- INÍCIO DA NOVA LÓGICA: Detalhes do Setup de Moldes por Braço ---
    // --- INÍCIO DA LÓGICA DE OTIMIZAÇÃO DE SETUP (SUBSTITUI A ANÁLISE DE SETUP ANTERIOR) ---
    let otimizacaoSetupSummaryString = "\n**Análise de Otimização de Setup (Alocação e Finalidade dos Moldes):**\n";
    if (progData && progData.length > 0) {
        const stockOrderIdsOtimizacao = { min: "9999997", med: "9999998", max: "9999999" };
        const allStockIdsOtimizacao = Object.values(stockOrderIdsOtimizacao);

        // 1. Calcula a finalidade de cada molde (baseado na primeira rodada de uso)
        const firstUseByMold = {};
        progData.forEach(item => {
            const mold = item.Produto;
            const round = item["Número da Rodada"];
            if (!firstUseByMold[mold] || round < firstUseByMold[mold].round) {
                firstUseByMold[mold] = { round: round, order: String(item.Pedido) };
            }
        });

        let countPedidos = 0, countEstoqueMin = 0, countEstoqueMed = 0, countEstoqueMax = 0;
        const processedMolds = new Set();

        progData.forEach(item => {
            const mold = item.Produto;
            const round = item["Número da Rodada"];
            const quantity = item["Quantidade de Moldes"] || 0;
            const firstUse = firstUseByMold[mold];

            if (firstUse && round === firstUse.round && !processedMolds.has(mold)) {
                if (firstUse.order === stockOrderIdsOtimizacao.min) countEstoqueMin += quantity;
                else if (firstUse.order === stockOrderIdsOtimizacao.med) countEstoqueMed += quantity;
                else if (firstUse.order === stockOrderIdsOtimizacao.max) countEstoqueMax += quantity;
                else if (!allStockIdsOtimizacao.includes(firstUse.order)) countPedidos += quantity;
                processedMolds.add(mold);
            }
        });

        otimizacaoSetupSummaryString += `- **Resumo de Finalidade dos Moldes:**\n`;
        otimizacaoSetupSummaryString += `  - Moldes para Pedidos de Clientes: ${countPedidos}\n`;
        otimizacaoSetupSummaryString += `  - Moldes para Estoque Mínimo: ${countEstoqueMin}\n`;
        otimizacaoSetupSummaryString += `  - Moldes para Estoque Médio: ${countEstoqueMed}\n`;
        otimizacaoSetupSummaryString += `  - Moldes para Estoque Máximo: ${countEstoqueMax}\n\n`;

        // 2. Detalha a alocação por braço
        const stockTypeMapOtimizacao = { "9999997": "Estoque Mínimo", "9999998": "Estoque Médio", "9999999": "Estoque Máximo" };
        const setupByArmOtimizacao = progData.reduce((acc, item) => {
            const arm = item.Braço;
            const mold = item.Produto;
            const order = String(item.Pedido);
            const quantity = item["Quantidade de Moldes"];

            if (!acc[arm]) acc[arm] = {};
            if (!acc[arm][mold]) {
                acc[arm][mold] = { producingFor: new Set(), quantity: quantity };
            }
            acc[arm][mold].producingFor.add(stockTypeMapOtimizacao[order] || `Pedido Cliente`);
            acc[arm][mold].quantity = quantity;
            return acc;
        }, {});

        otimizacaoSetupSummaryString += `- **Alocação Detalhada por Braço:**\n`;
        const sortedArmsOtimizacao = Object.keys(setupByArmOtimizacao).sort((a, b) => a - b);
        if (sortedArmsOtimizacao.length > 0) {
            sortedArmsOtimizacao.forEach(arm => {
                const moldsInArm = setupByArmOtimizacao[arm];
                const totalMoldsInArm = Object.values(moldsInArm).reduce((sum, moldData) => sum + (moldData.quantity || 0), 0);
                otimizacaoSetupSummaryString += `  - **Braço ${arm} (Total: ${totalMoldsInArm} moldes):**\n`;
                Object.keys(moldsInArm).sort().forEach(mold => {
                    const moldData = moldsInArm[mold];
                    const producingForText = Array.from(moldData.producingFor).join(', ');
                    otimizacaoSetupSummaryString += `    - ${mold} (Qtd: ${moldData.quantity}): produzindo para ${producingForText}\n`;
                });
            });
        } else {
            otimizacaoSetupSummaryString += "  Nenhuma alocação de molde encontrada.\n";
        }

    } else {
        otimizacaoSetupSummaryString += "Nenhum dado de programação para analisar o setup.\n";
    }
    // --- FIM DA NOVA LÓGICA ---

    // --- INÍCIO DA NOVA LÓGICA: Inventário de Moldes ---
    let inventorySummaryString = "\n**Inventário de Moldes (Cadastrados vs. Instalados):**\n";
    if (inventarioData.length > 0) {
        inventarioData.sort((a, b) => a.Produto.localeCompare(b.Produto)).forEach(item => {
            inventorySummaryString += `- ${item.Produto}: ${item.Cadastrados} cadastrado(s), ${item.Instalados} instalado(s).\n`;
        });
    } else {
        inventorySummaryString += "Nenhuma informação de inventário de moldes disponível (verifique o cadastro de moldes).\n";
    }
    // --- FIM DA NOVA LÓGICA ---

    // --- INÍCIO DA NOVA LÓGICA: Projeção de Finalização de Pedidos ---
    let projectionSummaryString = "\n**Projeção de Finalização de Pedidos (Diário):**\n";
    try {
        if (planningData._id) {
            const projectionResponse = await fetch('/api/gantt/projecao_finalizacao_pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ programacao_id: planningData._id })
            });

            if (projectionResponse.ok) {
                const projectionData = await projectionResponse.json();
                if (projectionData.labels && projectionData.labels.length > 0) {
                    projectionData.labels.forEach((label, index) => {
                        projectionSummaryString += `- **Data: ${label}** | Pedidos: ${projectionData.data_quantidade[index]} | Itens: ${projectionData.data_itens[index].toLocaleString('pt-BR')} | Valor: ${projectionData.data_valor[index].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;

                        // Adicionar detalhes dos pedidos que compõem o valor do dia
                        if (projectionData.detalhes_por_dia && projectionData.detalhes_por_dia[label]) {
                            const detalhesDoDia = projectionData.detalhes_por_dia[label];
                            // Agrupar por pedido para não repetir o valor total
                            const pedidosDoDia = detalhesDoDia.reduce((acc, item) => {
                                if (!acc[item.pedido]) {
                                    acc[item.pedido] = { cliente: item.cliente, valor: item.valorPedido };
                                }
                                return acc;
                            }, {});
                            Object.keys(pedidosDoDia).forEach(pedidoId => {
                                const pedidoInfo = pedidosDoDia[pedidoId];
                                projectionSummaryString += `  - Pedido ${pedidoId} (${pedidoInfo.cliente}): ${pedidoInfo.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
                            });
                        }
                    });
                } else {
                    projectionSummaryString += "Nenhuma projeção de finalização disponível para este planejamento.\n";
                }
            } else {
                projectionSummaryString += "Não foi possível carregar os dados de projeção.\n";
            }
        } else {
            projectionSummaryString += "Não foi possível carregar os dados de projeção (ID do planejamento ausente).\n";
        }
    } catch (error) {
        projectionSummaryString += "Erro ao carregar dados de projeção.\n";
    }
    // --- FIM DA NOVA LÓGICA ---

    // --- INÍCIO DA NOVA LÓGICA: Detalhes dos Pontos de Atenção ---
    const stockTypeMap = { "9999997": "Mínimo", "9999998": "Médio", "9999999": "Máximo" };
    let attentionPointsSummary = "\n**Detalhes dos Pontos de Atenção:**\n";

    // 1. Detalhes dos Moldes Ociosos
    if (ociososData.length > 0) {
        attentionPointsSummary += "- **Moldes Ociosos (Instalados mas não usados):**\n";
        ociososData.forEach(item => {
            attentionPointsSummary += `  - ${item.Nome} (Braço: ${item.Braço}, Qtd: ${item.Quantidade})\n`;
        });
    } else {
        attentionPointsSummary += "- **Moldes Ociosos:** Nenhum molde ocioso encontrado.\n";
    }

    // 2. Detalhes da Demanda Não Atendida (com moldes cadastrados)
    const unfulfilledDemand = necessidadeData.filter(n => n['Qtd. Moldes Cadastrados'] > 0);
    if (unfulfilledDemand.length > 0) {
        attentionPointsSummary += "- **Demanda Não Atendida (com moldes cadastrados mas sem setup):**\n";
        const groupedDemand = unfulfilledDemand.reduce((acc, item) => {
            const product = item.Produto || item.Nome;
            if (!acc[product]) {
                acc[product] = { quantity: 0, orders: new Set() };
            }
            acc[product].quantity += item.Quantidade;
            acc[product].orders.add(item.Pedido);
            return acc;
        }, {});
        Object.keys(groupedDemand).sort().forEach(product => {
            const details = groupedDemand[product];
            const orderText = stockOrderIds.includes(String(Array.from(details.orders)[0])) ? 'Estoque' : `Pedido(s) ${Array.from(details.orders).join(', ')}`;
            attentionPointsSummary += `  - ${product}: Faltam ${details.quantity.toLocaleString('pt-BR')} unidades (${orderText}).\n`;
        });
    } else {
        attentionPointsSummary += "- **Demanda Não Atendida:** Nenhuma demanda não atendida (com moldes cadastrados) encontrada.\n";
    }

    // 3. Detalhes dos Moldes Produzindo para Estoque
    const stockProduction = progData.filter(p => stockOrderIds.includes(String(p.Pedido)));
    if (stockProduction.length > 0) {
        attentionPointsSummary += "- **Moldes Produzindo para Estoque (potenciais para troca):**\n";
        const groupedStock = stockProduction.reduce((acc, item) => {
            const product = item.Produto;
            if (!acc[product]) acc[product] = { quantity: 0, types: new Set(), arms: new Set() };
            acc[product].quantity += item['Quantidade Programada'];
            acc[product].types.add(stockTypeMap[String(item.Pedido)]);
            acc[product].arms.add(item.Braço);
            return acc;
        }, {});
        Object.keys(groupedStock).sort().forEach(product => {
            const details = groupedStock[product];
            attentionPointsSummary += `  - ${product}: ${details.quantity.toLocaleString('pt-BR')} unidades (Tipo: ${Array.from(details.types).join('/')}, Braço(s): ${Array.from(details.arms).join(', ')})\n`;
        });
    }
    // --- FIM DA NOVA LÓGICA ---

    // --- INÍCIO DA NOVA LÓGICA: Análise de Atrasos Comparativa ---
    let delaySummaryString = "\n**Análise de Atrasos (Comparativo com Planejamento Anterior):**\n";
    try {
        const delayResponse = await fetch('/api/gantt/gantt_comparacao_atrasos');
        if (delayResponse.ok) {
            const delayData = await delayResponse.json();
            if (delayData.table_data && delayData.table_data.length > 0) {
                delayData.table_data.forEach(item => {
                    delaySummaryString += `- **Pedido ${item.pedido} (${item.cliente}):** Atrasou ${item.dias_atraso} dia(s).\n`;
                    if (item.itens_causadores && item.itens_causadores.length > 0) {
                        const topItem = item.itens_causadores[0]; // Pega o item de maior impacto
                        delaySummaryString += `  - Principal item impactado: ${topItem.produto} (Cor: ${topItem.cor || 'N/A'})\n`;
                    }
                });
            } else {
                delaySummaryString += "Nenhum atraso significativo foi detectado em comparação com o planejamento anterior.\n";
            }
        } else {
            delaySummaryString += "Não foi possível carregar a análise de atrasos comparativa.\n";
        }
    } catch (error) {
        delaySummaryString += "Erro ao carregar a análise de atrasos comparativa.\n";
    }
    // --- FIM DA NOVA LÓGICA ---

    // --- INÍCIO DA NOVA LÓGICA: Análise do Histórico de Atrasos ---
    let historicalDelaySummaryString = "\n**Análise do Histórico de Atrasos (Causas Raiz):**\n";
    try {
        const historicalDelayResponse = await fetch('/api/gantt/historico_atrasos');
        if (historicalDelayResponse.ok) {
            const historicalData = await historicalDelayResponse.json();
            const historicoAtrasos = historicalData.historico_atrasos || [];

            if (historicoAtrasos.length > 0) {
                // 1. Contar a frequência dos motivos
                const motivosCount = historicoAtrasos.reduce((acc, item) => {
                    const motivo = item.motivo_atraso || 'Não Atribuído';
                    acc[motivo] = (acc[motivo] || 0) + 1;
                    return acc;
                }, {});

                const sortedMotivos = Object.entries(motivosCount).sort((a, b) => b[1] - a[1]);

                historicalDelaySummaryString += "- **Principais Motivos de Atraso (Ocorrências):**\n";
                sortedMotivos.forEach(([motivo, count]) => {
                    historicalDelaySummaryString += `  - ${motivo}: ${count} vez(es)\n`;
                });

            } else {
                historicalDelaySummaryString += "Nenhum registro de atraso encontrado no histórico.\n";
            }
        } else {
            historicalDelaySummaryString += "Não foi possível carregar o histórico de atrasos para análise.\n";
        }
    } catch (error) {
        historicalDelaySummaryString += "Erro ao carregar o histórico de atrasos para análise.\n";
    }
    // --- FIM DA NOVA LÓGICA ---

    const dailyProduction = progData.reduce((acc, item) => {
        const date = item['Data Prevista'];
        const product = item['Produto'];
        const quantity = item['Quantidade Programada'];
        const isStock = stockOrderIds.includes(String(item.Pedido));
        const type = isStock ? 'Estoque' : 'Pedido Cliente';

        if (!acc[date]) acc[date] = {};
        if (!acc[date][product]) acc[date][product] = { 'Estoque': 0, 'Pedido Cliente': 0 };
        acc[date][product][type] += quantity;

        return acc;
    }, {});

    let dailySummaryString = "\n**Resumo da Produção Diária (Produto, Tipo e Quantidade):**\n";
    const sortedDates = Object.keys(dailyProduction).sort((a, b) => {
        const partsA = a.split('/'); const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]);
        const partsB = b.split('/'); const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
        return dateA - dateB;
    });

    if (sortedDates.length > 0) {
        sortedDates.forEach(date => {
            dailySummaryString += `- **Data: ${date}**\n`;
            const products = dailyProduction[date];
            Object.keys(products).sort().forEach(product => {
                const details = products[product];
                let productDetails = [];
                if (details['Pedido Cliente'] > 0) productDetails.push(`para Pedidos: ${details['Pedido Cliente'].toLocaleString('pt-BR')}`);
                if (details['Estoque'] > 0) productDetails.push(`para Estoque: ${details['Estoque'].toLocaleString('pt-BR')}`);
                dailySummaryString += `  - ${product}: ${productDetails.join('; ')}\n`;
            });
        });
    } else {
        dailySummaryString += "Nenhuma produção programada.\n";
    }

    let context = `
## Contexto do Planejamento de Produção Ativo

**ID do Planejamento:** ${planningData._id || 'N/A'}
**Data de Geração:** ${new Date(planningData.timestamp).toLocaleString('pt-BR')}
**Parâmetros:**
- **Duração:** ${planningData.dias_programacao || 'N/A'} dias
- **Braço Selecionado:** ${planningData.braco_selecionado || 'Todos'}
- **Modo de Sequenciamento:** ${planningData.modo_sequenciamento || 'N/A'}

**Resumo dos Resultados (KPIs):**
- **Total de Pedidos Planejados:** ${totalPedidos}
- **Total de Itens para Pedidos de Clientes:** ${itensPedidos.toLocaleString('pt-BR')}
- **Total de Itens para Estoque:** ${itensEstoque.toLocaleString('pt-BR')}

**Resumo dos Pontos de Atenção:**
- **SKUs com Demanda Não Atendida (por falta de setup):** ${skusNaoPlanejados}
- **Moldes Ociosos (instalados mas não usados):** ${moldesOciosos}
${attentionPointsSummary}
${delaySummaryString}
${inventorySummaryString}
${historicalDelaySummaryString}
${otimizacaoSetupSummaryString}
${projectionSummaryString}
${dailySummaryString}
Com base neste contexto, responda à pergunta do usuário de forma analítica e precisa.
    `;

    return context.trim();
}