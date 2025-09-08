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