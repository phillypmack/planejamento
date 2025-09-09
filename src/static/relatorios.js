document.addEventListener("DOMContentLoaded", () => {
    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        displayActivePlanBanner();
        initializeAIChat(); // Adiciona a inicialização do chat de IA
        loadHistoricoParaRelatorios();
    }

    function setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

        // Relatórios
        document.getElementById('gerar-pdf-btn').addEventListener('click', gerarRelatorioPDF);
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

    async function loadHistoricoParaRelatorios() {
        const select = document.getElementById('relatorio-programacao-select');
        const button = document.getElementById('gerar-pdf-btn');
        select.innerHTML = '<option>Carregando histórico...</option>';
        button.disabled = true;

        try {
            const response = await fetch('/api/programacao/obter_historico');
            const result = await response.json();

            if (response.ok && result.historico && result.historico.length > 0) {
                select.innerHTML = '<option value="">Selecione uma programação</option>';
                result.historico.forEach(item => {
                    const date = new Date(item.timestamp).toLocaleString('pt-BR');
                    const option = document.createElement('option');
                    option.value = item._id;
                    option.textContent = `${date} - Braço: ${item.braco_selecionado || 'Todos'}`;
                    select.appendChild(option);
                });
                select.onchange = () => {
                    button.disabled = select.value === '';
                };
            } else {
                select.innerHTML = '<option>Nenhum histórico encontrado</option>';
            }
        } catch (error) {
            console.error('Erro ao carregar histórico para relatórios:', error);
            select.innerHTML = '<option>Erro ao carregar histórico</option>';
        }
    }

    async function gerarRelatorioPDF() {
        const select = document.getElementById('relatorio-programacao-select');
        const programacaoId = select.value;

        if (!programacaoId) {
            alert('Por favor, selecione uma programação para gerar o relatório.');
            return;
        }

        showLoading();
        const button = document.getElementById('gerar-pdf-btn');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando...';

        try {
            const response = await fetch(`/api/gantt/gerar_relatorio_pdf/${programacaoId}`, { method: 'POST' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro no servidor ao gerar o PDF.');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `relatorio_programacao_${programacaoId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

        } catch (error) {
            alert(`Erro ao gerar relatório: ${error.message}`);
        } finally {
            hideLoading();
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-file-pdf mr-2"></i>Gerar PDF';
        }
    }

    function showLoading() {
        document.getElementById('loading-layer').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('loading-layer').classList.add('hidden');
    }

    // Global functions for onclick handlers
    window.gerarRelatorioPDF = gerarRelatorioPDF;
});