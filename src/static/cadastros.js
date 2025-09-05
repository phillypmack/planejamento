document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let motivosOcorrenciaCache = null;

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        loadMotivosOcorrencia();
    }

    function setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

        // Cadastros
        document.getElementById('adicionar-motivo-btn').addEventListener('click', adicionarMotivo);
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

    function showLoading() {
        document.getElementById('loading-layer').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('loading-layer').classList.add('hidden');
    }

    async function loadMotivosOcorrencia() {
        // 1. Verifica se os dados já estão em cache
        if (motivosOcorrenciaCache) {
            renderMotivos(motivosOcorrenciaCache); // Renderiza a partir do cache
            return;
        }

        try {
            const response = await fetch('/api/gantt/motivos/listar');
            const result = await response.json();
            const tbody = document.getElementById('motivos-tabela-body');
            tbody.innerHTML = '';

            if (response.ok && result.motivos && result.motivos.length > 0) {
                motivosOcorrenciaCache = result.motivos; // 2. Salva os dados no cache
                renderMotivos(motivosOcorrenciaCache);
            } else {
                tbody.innerHTML = '<tr><td colspan="2" class="px-4 py-2 text-gray-400 text-center">Nenhum motivo cadastrado.</td></tr>';
            }
        } catch (error) {
            console.error('Erro ao carregar motivos:', error);
            document.getElementById('motivos-tabela-body').innerHTML = '<tr><td colspan="2" class="px-4 py-2 text-red-400 text-center">Erro ao carregar motivos.</td></tr>';
        }
    }

    function renderMotivos(motivos) {
        const tbody = document.getElementById('motivos-tabela-body');
        tbody.innerHTML = '';
        if (motivos && motivos.length > 0) {
            motivos.forEach(motivo => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td class="px-4 py-2">${motivo.motivo}</td>
                    <td class="px-4 py-2 text-right"><button class="text-red-500 hover:text-red-400" onclick="excluirMotivo('${motivo._id}')"><i class="fas fa-trash-alt"></i></button></td>
                `;
            });
        }
    }

    async function adicionarMotivo() {
        const input = document.getElementById('novo-motivo-input');
        const motivoText = input.value.trim();
        if (!motivoText) { alert('Por favor, digite um motivo.'); return; }
        try {
            const response = await fetch('/api/gantt/motivos/adicionar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: motivoText }) });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.error || 'Erro ao adicionar motivo'); }
            alert(result.message);
            input.value = '';
            motivosOcorrenciaCache = null; // Invalida o cache para forçar o recarregamento
            loadMotivosOcorrencia();
        } catch (error) { alert(`Erro: ${error.message}`); }
    }

    window.excluirMotivo = async function (id) {
        if (!confirm('Tem certeza que deseja excluir este motivo?')) { return; }
        try {
            const response = await fetch(`/api/gantt/motivos/excluir/${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.error || 'Erro ao excluir motivo'); }
            alert(result.message);
            motivosOcorrenciaCache = null; // Invalida o cache
            loadMotivosOcorrencia();
        } catch (error) { alert(`Erro: ${error.message}`); }
    };
});