document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let dadosOriginais = null;

    // Initialize the application
    initializeApp();

    function initializeApp() {
        setupEventListeners();
        loadAndRenderGanttCharts();
    }

    function setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

        // Reload button
        document.getElementById('reload-gantt-btn').addEventListener('click', loadAndRenderGanttCharts);
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

    async function loadAndRenderGanttCharts() {
        showLoading();
        const success = await fetchAndSetLatestPlanningData();
        if (success && dadosOriginais.programacao_data) {
            createMoldGantt(dadosOriginais.programacao_data);
            createOrderGantt(dadosOriginais.programacao_data);
        } else {
            const ganttMoldesContainer = document.getElementById('gantt-moldes-full');
            const ganttPedidosContainer = document.getElementById('gantt-pedidos-full');
            const errorMessage = '<p class="text-secondary text-center py-8">Nenhum dado de planejamento encontrado para gerar os gráficos.</p>';
            ganttMoldesContainer.innerHTML = errorMessage;
            ganttPedidosContainer.innerHTML = errorMessage;
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
            alert(`Erro ao buscar último planejamento: ${error.message}`);
            dadosOriginais = null;
            return false;
        }
    }

    function createMoldGantt(data) {
        const container = document.getElementById('gantt-moldes-full');
        container.innerHTML = ''; // Clear previous content
        const ganttData = processDataForMoldGantt(data);

        if (ganttData.length > 0) {
            const gantt = new Gantt(container, ganttData, {
                header_height: 50,
                column_width: 30,
                step: 24,
                view_modes: ['Day', 'Week', 'Month'],
                bar_height: 20,
                bar_corner_radius: 3,
                padding: 18,
                view_mode: 'Week',
                date_format: 'DD/MM/YYYY',
                custom_popup_html: null
            });
            setupGanttHeader(gantt, container);
        } else {
            container.innerHTML = '<p class="text-secondary text-center py-8">Sem dados de ocupação de moldes.</p>';
        }
    }

    function createOrderGantt(data) {
        const container = document.getElementById('gantt-pedidos-full');
        container.innerHTML = ''; // Clear previous content
        const ganttData = processDataForOrderGantt(data);

        if (ganttData.length > 0) {
            const gantt = new Gantt(container, ganttData, {
                header_height: 50,
                column_width: 30,
                step: 24,
                view_modes: ['Day', 'Week', 'Month'],
                bar_height: 20,
                bar_corner_radius: 3,
                padding: 18,
                view_mode: 'Week',
                date_format: 'DD/MM/YYYY',
                custom_popup_html: null
            });
            setupGanttHeader(gantt, container);
        } else {
            container.innerHTML = '<p class="text-secondary text-center py-8">Sem dados de previsão de pedidos.</p>';
        }
    }

    function setupGanttHeader(gantt, container) {
        const header = container.querySelector('.grid-header');
        if (header) {
            header.parentNode.appendChild(header);
            container.addEventListener('scroll', () => {
                header.setAttribute('transform', `translate(0, ${container.scrollTop})`);
            });
        }
    }

    function processDataForMoldGantt(data) {
        const ganttTasks = [];
        const moldOccupation = {};

        data.forEach(item => {
            const key = `${item.Produto} (Braço ${item.Braço})`;
            const date = item["Data Prevista"];
            if (!date) return;

            if (!moldOccupation[key]) {
                moldOccupation[key] = new Set();
            }
            moldOccupation[key].add(date);
        });

        Object.keys(moldOccupation).forEach((key, index) => {
            let dates = Array.from(moldOccupation[key]);
            if (dates.length === 0) return;

            dates.sort((a, b) => new Date(convertDateFormat(a)) - new Date(convertDateFormat(b)));

            const startDate = convertDateFormat(dates[0]);
            const endDateObj = new Date(convertDateFormat(dates[dates.length - 1]));
            endDateObj.setDate(endDateObj.getDate() + 1);

            ganttTasks.push({
                id: `mold-${index}`,
                name: key,
                start: startDate,
                end: formatDateForGantt(endDateObj),
                progress: 100,
                custom_class: 'bar-order'
            });
        });

        return ganttTasks;
    }

    function processDataForOrderGantt(data) {
        const ganttTasks = [];
        const orderProgress = {};

        data.forEach(item => {
            const key = `${item.Pedido}-${item.Produto}`;
            const date = item["Data Prevista"];
            if (!date) return;

            if (!orderProgress[key]) {
                orderProgress[key] = { dates: new Set(), orderId: item.Pedido };
            }
            orderProgress[key].dates.add(date);
        });

        Object.keys(orderProgress).forEach((key, index) => {
            let dates = Array.from(orderProgress[key].dates);
            if (dates.length === 0) return;

            dates.sort((a, b) => new Date(convertDateFormat(a)) - new Date(convertDateFormat(b)));

            const startDate = convertDateFormat(dates[0]);
            const endDateObj = new Date(convertDateFormat(dates[dates.length - 1]));
            endDateObj.setDate(endDateObj.getDate() + 1);

            const orderId = orderProgress[key].orderId;
            const isStockOrder = ["9999997", "9999998", "9999999"].includes(String(orderId));
            const customClass = isStockOrder ? 'bar-stock' : 'bar-order';

            ganttTasks.push({
                id: `order-${index}`,
                name: `Pedido ${key}`,
                start: startDate,
                end: formatDateForGantt(endDateObj),
                progress: 100,
                custom_class: customClass
            });
        });

        return ganttTasks;
    }

    function formatDateForGantt(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function convertDateFormat(dateStr) {
        // Convert from DD/MM/YYYY to YYYY-MM-DD
        const parts = dateStr.split('/');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    function showLoading() {
        document.getElementById('loading-layer').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('loading-layer').classList.add('hidden');
    }
});