// Sistema MRP/PCP - JavaScript Redesigned
// Variáveis globais
let currentStep = 1;
let setupData = null;
let faltasData = null;
let cadastroMoldesData = null;
let programacaoResults = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadDashboardData();
});

// Inicialização da aplicação
function initializeApp() {
    console.log('Sistema MRP/PCP iniciado');
    
    // Configurar navegação
    setupNavigation();
    
    // Configurar sidebar toggle
    setupSidebarToggle();
    
    // Configurar upload de arquivos
    setupFileUploads();
    
    // Configurar steps do planejamento
    setupPlanningSteps();
}

// Configurar event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', handleNavigation);
    });
    
    // File uploads
    document.getElementById('setup-file').addEventListener('change', handleSetupFile);
    document.getElementById('faltas-file').addEventListener('change', handleFaltasFile);
    document.getElementById('cadastro-moldes-file').addEventListener('change', handleCadastroFile);
    
    // Planning steps
    document.getElementById('next-step-1').addEventListener('click', () => goToStep(2));
    document.getElementById('next-step-2').addEventListener('click', () => goToStep(3));
    document.getElementById('prev-step-2').addEventListener('click', () => goToStep(1));
    document.getElementById('prev-step-3').addEventListener('click', () => goToStep(2));
    
    // Execute planning
    document.getElementById('executar-programacao').addEventListener('click', executeProgramacao);
    
    // New planning
    document.getElementById('novo-planejamento').addEventListener('click', resetPlanning);
}

// Configurar navegação
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            // Get section
            const section = item.dataset.section;
            showSection(section);
            
            // Update page title
            updatePageTitle(item.textContent.trim());
        });
    });
}

// Configurar toggle da sidebar
function setupSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    });
}

// Configurar uploads de arquivo
function setupFileUploads() {
    setupFileUpload('setup-file', 'setup-status');
    setupFileUpload('faltas-file', 'faltas-status');
    setupFileUpload('cadastro-moldes-file', 'cadastro-status');
}

function setupFileUpload(inputId, statusId) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    const label = input.parentElement.querySelector('.file-upload-label span');
    
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            label.textContent = file.name;
            status.textContent = `Arquivo selecionado: ${file.name}`;
            status.style.color = '#3D9970';
            
            // Update next button state
            updateNextButtonState();
        } else {
            label.textContent = 'Selecionar arquivo';
            status.textContent = '';
        }
    });
}

// Configurar steps do planejamento
function setupPlanningSteps() {
    updateStepIndicator();
}

// Mostrar seção
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show selected section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    
    // Update page title
    const titles = {
        'dashboard': 'Visão Geral',
        'planejamento': 'Novo Planejamento',
        'analise': 'Análise Histórica',
        'relatorios': 'Relatórios',
        'gantt': 'Gráficos Gantt'
    };
    
    updatePageTitle(titles[sectionName] || 'Sistema MRP/PCP');
}

// Atualizar título da página
function updatePageTitle(title) {
    document.getElementById('pageTitle').textContent = title;
}

// Navegação entre steps
function goToStep(step) {
    // Hide current step
    document.getElementById(`step-${currentStep}`).classList.add('hidden');
    
    // Show new step
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
    // Update current step
    currentStep = step;
    
    // Update step indicator
    updateStepIndicator();
}

// Atualizar indicador de steps
function updateStepIndicator() {
    for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById(`step-${i}-indicator`);
        const line = document.getElementById(`line-${i}`);
        
        if (i < currentStep) {
            indicator.classList.add('completed');
            indicator.classList.remove('active');
            if (line) line.classList.add('completed');
        } else if (i === currentStep) {
            indicator.classList.add('active');
            indicator.classList.remove('completed');
        } else {
            indicator.classList.remove('active', 'completed');
            if (line) line.classList.remove('completed');
        }
    }
}

// Atualizar estado do botão próximo
function updateNextButtonState() {
    const setupFile = document.getElementById('setup-file').files[0];
    const faltasFile = document.getElementById('faltas-file').files[0];
    const nextButton = document.getElementById('next-step-1');
    
    if (setupFile && faltasFile) {
        nextButton.disabled = false;
        nextButton.style.opacity = '1';
    } else {
        nextButton.disabled = true;
        nextButton.style.opacity = '0.5';
    }
}

// Handlers de arquivo
async function handleSetupFile(e) {
    const file = e.target.files[0];
    if (file) {
        const success = await uploadFile(file, '/api/programacao/upload_setup', 'setup-status');
        if (success) {
            readExcelFile(file, (data) => {
                setupData = data;
                console.log('Setup data loaded:', setupData);
                populateBracoOptions(data);
            });
        }
    }
}

async function handleFaltasFile(e) {
    const file = e.target.files[0];
    if (file) {
        const success = await uploadFile(file, '/api/programacao/upload_faltas', 'faltas-status');
        if (success) {
            readExcelFile(file, (data) => {
                faltasData = data;
                console.log('Faltas data loaded:', faltasData);
            });
        }
    }
}

async function handleCadastroFile(e) {
    const file = e.target.files[0];
    if (file) {
        await uploadFile(file, '/api/programacao/upload_cadastro_moldes', 'cadastro-status');
    }
}

async function uploadFile(file, url, statusId) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        showNotification(result.message || 'Arquivo enviado com sucesso!', 'success');
        document.getElementById(statusId).textContent = result.message || `Arquivo ${file.name} carregado.`;
        return true;
    } catch (error) {
        console.error('Erro ao enviar arquivo:', error);
        showNotification(`Erro ao enviar o arquivo ${file.name}.`, 'error');
        document.getElementById(statusId).textContent = `Erro ao carregar ${file.name}.`;
        return false;
    }
}

// Ler arquivo Excel
function readExcelFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            callback(jsonData);
        } catch (error) {
            console.error('Erro ao ler arquivo:', error);
            showNotification('Erro ao ler arquivo. Verifique o formato.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Popular opções de braço
function populateBracoOptions(data) {
    const bracoSelect = document.getElementById('braco-selecionado');
    const bracos = [...new Set(data.map(item => item['Braço'] || item['CODBRACO']).filter(Boolean))];
    
    // Clear existing options except "Todos"
    bracoSelect.innerHTML = '<option value="Todos">Todos</option>';
    
    // Add braço options
    bracos.forEach(braco => {
        const option = document.createElement('option');
        option.value = braco;
        option.textContent = braco;
        bracoSelect.appendChild(option);
    });
}

// Executar programação
async function executeProgramacao() {
    if (!setupData || !faltasData) {
        showNotification('Por favor, carregue os arquivos de Setup e Faltas.', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const params = {
            'braco_selecionado': document.getElementById('braco-selecionado').value,
            'dias_programacao': document.getElementById('dias-programacao').value,
            'modo_sequenciamento': document.getElementById('modo-sequenciamento').value,
            'priorizacao_pedidos': document.getElementById('priorizacao-pedidos').value
        };
        
        const response = await fetch('/api/programacao/executar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        programacaoResults = result;
        
        displayResults(result);
        showNotification('Programação executada com sucesso!', 'success');
        
        // Show new planning button
        document.getElementById('novo-planejamento').classList.remove('hidden');
        
    } catch (error) {
        console.error('Erro ao executar programação:', error);
        showNotification(error.message || 'Erro ao executar programação. Tente novamente.', 'error');
    } finally {
        showLoading(false);
    }
}

// Exibir resultados
function displayResults(results) {
    const container = document.getElementById('resultados-programacao');
    container.classList.remove('hidden');
    
    container.innerHTML = `
        <div class="card" style="background: #2d2d2d; margin-bottom: 1rem;">
            <h4 style="color: #ffffff; margin-bottom: 1rem;">Resumo da Programação</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #0074D9;">${results.total_pedidos || 0}</div>
                    <div style="color: #cccccc;">Total de Pedidos</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #3D9970;">${results.moldes_utilizados || 0}</div>
                    <div style="color: #cccccc;">Moldes Utilizados</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #FFDC00; color: #1a1a1a;">${results.moldes_ociosos || 0}</div>
                    <div style="color: #cccccc;">Moldes Ociosos</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #7FDBFF; color: #1a1a1a;">${results.dias_programados || 0}</div>
                    <div style="color: #cccccc;">Dias Programados</div>
                </div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
            <button class="btn btn-primary" onclick="showSection('gantt')">
                <i class="fas fa-chart-gantt"></i>
                <span>Ver Gráficos Gantt</span>
            </button>
            <button class="btn btn-secondary" onclick="gerarRelatorioPDF()">
                <i class="fas fa-file-pdf"></i>
                <span>Gerar Relatório PDF</span>
            </button>
            <button class="btn btn-warning" onclick="analiseTendencias()">
                <i class="fas fa-chart-line"></i>
                <span>Análise de Tendências</span>
            </button>
        </div>
    `;
}

// Reset planning
function resetPlanning() {
    currentStep = 1;
    setupData = null;
    faltasData = null;
    cadastroMoldesData = null;
    programacaoResults = null;
    
    // Reset forms
    document.getElementById('setup-file').value = '';
    document.getElementById('faltas-file').value = '';
    document.getElementById('cadastro-moldes-file').value = '';
    document.getElementById('dias-programacao').value = '50';
    document.getElementById('modo-sequenciamento').value = 'Otimizado';
    document.getElementById('priorizacao-pedidos').value = '';
    
    // Reset file upload labels
    document.querySelectorAll('.file-upload-label span').forEach(span => {
        span.textContent = 'Selecionar arquivo';
    });
    
    // Reset status messages
    document.querySelectorAll('[id$="-status"]').forEach(status => {
        status.textContent = '';
    });
    
    // Hide results
    document.getElementById('resultados-programacao').classList.add('hidden');
    document.getElementById('novo-planejamento').classList.add('hidden');
    
    // Go to step 1
    goToStep(1);
    
    // Update next button state
    updateNextButtonState();
}

// Carregar dados do dashboard
async function loadDashboardData() {
    try {
        // Simular carregamento de dados
        setTimeout(() => {
            updateKPIs({
                pedidos: Math.floor(Math.random() * 100) + 50,
                ocupacao: Math.floor(Math.random() * 30) + 70,
                criticos: Math.floor(Math.random() * 10) + 5,
                ociosos: Math.floor(Math.random() * 20) + 10
            });
        }, 1000);
        
    } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
    }
}

// Atualizar KPIs
function updateKPIs(data) {
    document.getElementById('kpi-pedidos').textContent = data.pedidos;
    document.getElementById('kpi-ocupacao').textContent = data.ocupacao + '%';
    document.getElementById('kpi-criticos').textContent = data.criticos;
    document.getElementById('kpi-ociosos').textContent = data.ociosos;
}

// Carregar último planejamento
function carregarUltimoPlanejamento() {
    showNotification('Carregando último planejamento...', 'info');
    // Implementar lógica para carregar último planejamento
}

// Gerar relatório PDF
function gerarRelatorioPDF() {
    showNotification('Gerando relatório PDF...', 'info');
    // Implementar lógica para gerar PDF
}

// Análise de tendências
function analiseTendencias() {
    showNotification('Carregando análise de tendências...', 'info');
    // Implementar lógica para análise de tendências
}

// Mostrar loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

// Mostrar notificação
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
    `;
    
    // Set background color based on type
    const colors = {
        'success': '#3D9970',
        'error': '#dc3545',
        'warning': '#FFDC00',
        'info': '#0074D9'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    if (type === 'warning') {
        notification.style.color = '#1a1a1a';
    }
    
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Navegação (função global para compatibilidade)
function handleNavigation(e) {
    e.preventDefault();
    const section = e.target.closest('.nav-item').dataset.section;
    showSection(section);
}

// Exportar funções globais para compatibilidade
window.showSection = showSection;
window.carregarUltimoPlanejamento = carregarUltimoPlanejamento;
window.gerarRelatorioPDF = gerarRelatorioPDF;
window.analiseTendencias = analiseTendencias;

