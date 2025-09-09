document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
});

function initializeApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const isIframeMode = urlParams.get('mode') === 'iframe';

    if (isIframeMode) {
        // Oculta elementos que não são necessários na visualização em modal
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const mainContent = document.getElementById('main-content');
        const section = document.getElementById('assistente-ia-section');

        if (sidebar) sidebar.style.display = 'none';
        if (sidebarToggle) sidebarToggle.style.display = 'none';
        if (mainContent) {
            mainContent.style.marginLeft = '0';
        }
        if (section) {
            // Reduz o padding para melhor encaixe no modal
            section.classList.remove('p-8');
            section.classList.add('p-4');
        }
    } else {
        loadSidebar(); // Carrega a sidebar dinamicamente apenas no modo de página inteira
    }

    setupEventListeners();
    displayActivePlanBanner();
    initializeDedicatedAIChat();
}

function setupEventListeners() {
    // Sidebar toggle (será adicionado dinamicamente)
    document.body.addEventListener('click', function (event) {
        if (event.target.id === 'sidebar-toggle' || event.target.closest('#sidebar-toggle')) {
            toggleSidebar();
        }
    });

    // Chat
    const aiChatSendBtn = document.getElementById('ai-chat-send-btn');
    const aiChatInput = document.getElementById('ai-chat-input');

    if (aiChatSendBtn) aiChatSendBtn.addEventListener('click', sendChatMessage);
    if (aiChatInput) aiChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Previne que o form seja submetido, caso exista
            sendChatMessage();
        }
    });
}

function initializeDedicatedAIChat() {
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (messagesContainer.children.length === 0) {
        // Limpa o histórico ao carregar a página dedicada para garantir uma sessão limpa
        chatHistory = [];
        appendMessage('Olá! Sou seu assistente de análise. Como posso ajudar a analisar o planejamento atual?', 'ai');
    }
    document.getElementById('ai-chat-input').focus();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const toggleIcon = document.querySelector('#sidebar-toggle i');

    if (!sidebar || !mainContent || !toggleIcon) return;

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

function showLoading() {
    document.getElementById('top-loading-bar').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('top-loading-bar').classList.add('hidden');
}

/**
 * Carrega o conteúdo da sidebar de um arquivo externo para evitar duplicação.
 * Isso não é ideal para produção, mas funciona para este contexto.
 * Uma abordagem melhor seria usar templates no lado do servidor ou web components.
 */
async function loadSidebar() {
    try {
        const response = await fetch('index_new.html');
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const sidebarContent = doc.querySelector('#sidebar').innerHTML;
        const sidebarContainer = document.getElementById('sidebar');
        if (sidebarContainer) {
            sidebarContainer.innerHTML = sidebarContent;
            // Marca o item de menu correto como ativo
            sidebarContainer.querySelector('.nav-item.active')?.classList.remove('active');
            sidebarContainer.querySelector('.nav-item[data-section="assistente-ia"]')?.classList.add('active');
        }
    } catch (error) {
        console.error('Erro ao carregar a sidebar:', error);
    }
}