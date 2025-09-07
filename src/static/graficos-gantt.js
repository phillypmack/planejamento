document.addEventListener("DOMContentLoaded", () => {
    // Global variables
    let dadosOriginais = null;
    const chartInstances = {
        moldes: null, pedidos: null, rodadas: null
    };
    const fullGanttData = {
        moldes: [], pedidos: [], rodadas: []
    };
    const ITEMS_PER_VIEW = 15; // Número de itens para mostrar na visualização inicial

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
        document.getElementById('reload-gantt-btn').addEventListener('click', () => loadAndRenderGanttCharts(true));

        // Toggles para mostrar todos os dados nos gráficos
        document.querySelectorAll('.toggle-switch').forEach(toggle => {
            toggle.addEventListener('change', (event) => {
                const chartName = event.target.dataset.chart;
                const showAll = event.target.checked;

                if (chartName === 'moldes') {
                    createMoldGantt(fullGanttData.moldes, showAll);
                } else if (chartName === 'pedidos') {
                    createOrderGantt(fullGanttData.pedidos, showAll);
                } else if (chartName === 'rodadas') {
                    createRoundGantt(fullGanttData.rodadas, showAll);
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

    async function loadAndRenderGanttCharts(forceReload = false) {
        showLoading();
        if (forceReload) {
            sessionStorage.removeItem('ganttChartCache');
            console.log("Cache dos gráficos Gantt limpo para forçar recarregamento.");
        }
        const success = await fetchAndSetLatestPlanningData(forceReload);
        if (success && dadosOriginais && dadosOriginais.programacao_data) {
            // Processa e armazena os dados completos
            fullGanttData.moldes = processDataForMoldGantt(dadosOriginais.programacao_data);
            fullGanttData.pedidos = processDataForOrderGantt(dadosOriginais.programacao_data);
            fullGanttData.rodadas = processDataForRoundGantt(dadosOriginais.programacao_data);

            // Renderiza a visualização inicial (limitada)
            createMoldGantt(fullGanttData.moldes, false);
            createOrderGantt(fullGanttData.pedidos, false);
            createRoundGantt(fullGanttData.rodadas, false);
        } else {
            const ganttMoldesContainer = document.getElementById('gantt-moldes-full');
            const ganttPedidosContainer = document.getElementById('gantt-pedidos-full');
            const ganttRodadasContainer = document.getElementById('gantt-rodadas-full');
            const errorMessage = '<p class="text-secondary text-center py-8">Nenhum dado de planejamento encontrado para gerar os gráficos.</p>';
            ganttMoldesContainer.innerHTML = errorMessage;
            ganttPedidosContainer.innerHTML = errorMessage;
            ganttRodadasContainer.innerHTML = errorMessage;
        }
        hideLoading();
    }

    async function fetchAndSetLatestPlanningData(forceReload = false) {
        const cacheKey = 'ganttChartCache';
        if (!forceReload) {
            const cachedData = sessionStorage.getItem(cacheKey);
            if (cachedData) {
                console.log("Carregando dados do Gantt do cache da sessão.");
                dadosOriginais = JSON.parse(cachedData);
                return true;
            }
        }

        console.log("Buscando dados do Gantt do servidor.");
        try {
            const response = await fetch('/api/gantt/obter_ultimo_planejamento');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Nenhum planejamento encontrado no histórico');
            }
            dadosOriginais = result.ultimo_planejamento;

            // Salva no cache para uso futuro na mesma sessão
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify(dadosOriginais));
            } catch (e) {
                console.warn("Não foi possível salvar os dados do Gantt no cache: " + e.name);
            }
            return true;
        } catch (error) {
            alert(`Erro ao buscar último planejamento: ${error.message}`);
            dadosOriginais = null;
            return false;
        }
    }

    /**
     * Retorna um objeto de opções base para os gráficos Gantt da ApexCharts.
     * Garante consistência visual e tema escuro.
     */
    const getBaseGanttOptions = () => ({
        chart: {
            type: 'rangeBar',
            // A altura será definida dinamicamente para cada gráfico para evitar compressão
            background: 'transparent',
            toolbar: {
                show: true,
                tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }
            }
        },
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '60%',
                rangeBarGroupRows: true
            }
        },
        theme: {
            mode: 'dark',
            palette: 'palette1'
        },
        dataLabels: {
            enabled: true,
            formatter: (val, opts) => {
                // Usa a propriedade 'label' customizada que adicionaremos aos dados
                const dataPoint = opts.w.config.series[opts.seriesIndex].data[opts.dataPointIndex];
                return dataPoint.label || '';
            },
            style: { colors: ['#fff'], fontSize: '12px' },
            textAnchor: 'middle'
        },
        xaxis: {
            type: 'datetime',
            labels: { style: { colors: 'var(--color-text-secondary)' }, datetimeUTC: false },
            axisBorder: { show: true, color: 'var(--color-text-secondary)' },
            axisTicks: { show: true, color: 'var(--color-text-secondary)' }
        },
        yaxis: { labels: { style: { colors: 'var(--color-text-main)', fontSize: '13px' }, minWidth: 100, maxWidth: 200 } },
        grid: { borderColor: '#4A4A4A' },
        tooltip: {
            theme: 'dark',
            x: { format: 'dd MMM yyyy' },
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const start = new Date(series[seriesIndex][dataPointIndex][0]).toLocaleDateString('pt-BR');
                const end = new Date(series[seriesIndex][dataPointIndex][1]).toLocaleDateString('pt-BR');
                const name = w.globals.seriesX[seriesIndex][dataPointIndex] || '';
                return `<div class="p-2">
                            <strong>${name}</strong><br>
                            Início: ${start}<br>
                            Fim: ${end} 
                        </div>`;
            }
        },
        noData: {
            text: 'Carregando dados...',
            align: 'center',
            verticalAlign: 'middle',
            style: { color: 'var(--color-text-main)', fontSize: '16px' }
        },
        series: []
    });

    /**
     * Calcula a altura do gráfico dinamicamente com base no número de linhas.
     * Isso evita que as barras fiquem espremidas quando há muitos dados.
     * @param {Array} data - Os dados da série do gráfico.
     * @param {boolean} isGrouped - Se as linhas com o mesmo rótulo y são agrupadas.
     * @returns {number} A altura calculada em pixels.
     */
    const calculateChartHeight = (data, isGrouped = false) => {
        const rowHeight = 45; // Altura estimada por linha em pixels
        const minHeight = 250; // Altura mínima do gráfico
        const headerHeight = 50; // Espaço para cabeçalho/eixos

        let numRows;
        if (isGrouped) {
            // Para gráficos com linhas agrupadas (ex: por rodada)
            numRows = new Set(data.map(d => d.x)).size;
        } else {
            // Para gráficos onde cada ponto de dado é uma linha
            numRows = data.length;
        }

        if (numRows === 0) {
            return minHeight;
        }

        const calculatedHeight = (numRows * rowHeight) + headerHeight;
        return Math.max(calculatedHeight, minHeight);
    };

    function createMoldGantt(allData, showAll = false) {
        const container = document.getElementById('gantt-moldes-full');
        container.innerHTML = ''; // Clear previous content

        // This chart now has one item per row, so we can use slice.
        const dataToShow = showAll ? allData : allData.slice(0, ITEMS_PER_VIEW);

        if (chartInstances.moldes) chartInstances.moldes.destroy();

        if (dataToShow.length > 0) {
            const options = getBaseGanttOptions();
            options.series = [{ data: dataToShow }];
            // Define a altura do gráfico dinamicamente, agora com uma linha por item
            options.chart.height = calculateChartHeight(dataToShow, false);
            options.yaxis.labels.maxWidth = 350;

            // Custom formatter for X-axis to show Round numbers
            const baseDate = new Date('2024-01-01T00:00:00Z');
            options.xaxis.labels.formatter = function (value) {
                const currentDate = new Date(value);
                const diffTime = currentDate.getTime() - baseDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                const roundNumber = diffDays + 1;
                return `R${roundNumber}`;
            };

            // Custom tooltip to show round ranges
            delete options.tooltip.x; // Remove default date formatter
            options.tooltip.custom = function ({ series, seriesIndex, dataPointIndex, w }) {
                const dataPoint = w.config.series[seriesIndex].data[dataPointIndex];
                const startMs = series[seriesIndex][dataPointIndex][0];
                const endMs = series[seriesIndex][dataPointIndex][1] - (24 * 60 * 60 * 1000); // Subtract the extra day for correct end round
                const taskName = dataPoint.x; // "Molde (Braço X)"

                const calcRound = (ms) => {
                    const diffTime = new Date(ms).getTime() - baseDate.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays + 1;
                };

                const startRound = calcRound(startMs);
                const endRound = calcRound(endMs);
                const roundText = startRound === endRound ? `Rodada: R${startRound}` : `Rodadas: R${startRound} a R${endRound}`;

                return `<div class="p-2">
                            <strong>${taskName}</strong><br>
                            ${roundText}
                        </div>`;
            };

            chartInstances.moldes = new ApexCharts(container, options);
            chartInstances.moldes.render();
        } else if (allData.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-8">Sem dados de ocupação de moldes.</p>';
        } else {
            // Caso onde há dados, mas o slice resultou em array vazio (não deve acontecer com slice(0,X))
            // ou o usuário desmarcou o toggle e não há dados para mostrar
        }
    }

    function createOrderGantt(allData, showAll = false) {
        const container = document.getElementById('gantt-pedidos-full');
        container.innerHTML = ''; // Clear previous content

        let dataToShow = allData;
        if (!showAll) {
            const uniqueLabels = [...new Set(allData.map(d => d.x))];
            const labelsToShow = uniqueLabels.slice(0, ITEMS_PER_VIEW);
            dataToShow = allData.filter(d => labelsToShow.includes(d.x));
        }

        if (chartInstances.pedidos) chartInstances.pedidos.destroy();

        if (dataToShow.length > 0) {
            const options = getBaseGanttOptions();
            options.series = [{ data: dataToShow }];
            // Define a altura do gráfico dinamicamente
            options.chart.height = calculateChartHeight(dataToShow, true);
            options.yaxis.labels.maxWidth = 350;

            // Custom tooltip para pedidos
            options.tooltip.custom = function ({ series, seriesIndex, dataPointIndex, w }) {
                const dataPoint = w.config.series[seriesIndex].data[dataPointIndex];
                const start = new Date(dataPoint.y[0]).toLocaleDateString('pt-BR');
                const end = new Date(dataPoint.y[1] - (24 * 60 * 60 * 1000)).toLocaleDateString('pt-BR');
                const groupName = dataPoint.x; // Pedido
                const taskName = dataPoint.label; // Produto
                return `<div class="p-2">
                            <strong>${taskName}</strong><br>
                            <span class="text-secondary">${groupName}</span><br>
                            Prazo: ${start} a ${end}
                        </div>`;
            };

            chartInstances.pedidos = new ApexCharts(container, options);
            chartInstances.pedidos.render();
        } else if (allData.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-8">Sem dados de previsão de pedidos.</p>';
        } else {
        }
    }

    function createRoundGantt(allData, showAll = false) {
        const container = document.getElementById('gantt-rodadas-full');
        container.innerHTML = ''; // Clear previous content

        let dataToShow = allData;
        if (showAll) {
            dataToShow = allData;
        } else {
            const uniqueLabels = [...new Set(allData.map(d => d.x))];
            const labelsToShow = uniqueLabels.slice(0, ITEMS_PER_VIEW);
            dataToShow = allData.filter(d => labelsToShow.includes(d.x));
        }

        if (chartInstances.rodadas) chartInstances.rodadas.destroy();

        if (dataToShow.length > 0) {
            const options = getBaseGanttOptions();
            options.series = [{ data: dataToShow }];
            // Define a altura do gráfico dinamicamente, considerando que as linhas são agrupadas
            options.chart.height = calculateChartHeight(dataToShow, true);
            options.yaxis.labels.maxWidth = 350;

            // Custom data label to show "Molde - Cor" on each bar
            options.dataLabels.style.colors = ['#fff']; // Ensure label is white

            const baseDate = new Date('2024-01-01T00:00:00Z');
            options.xaxis.labels.formatter = function (value) {
                const currentDate = new Date(value);
                const diffTime = currentDate.getTime() - baseDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                const roundNumber = diffDays + 1;
                return `R${roundNumber}`;
            };

            // Custom tooltip to show round ranges and "Molde - Cor"
            delete options.tooltip.x; // Remove default date formatter
            options.tooltip.custom = function ({ series, seriesIndex, dataPointIndex, w }) {
                const dataPoint = w.config.series[seriesIndex].data[dataPointIndex];
                const startMs = dataPoint.y[0];
                const endMs = dataPoint.y[1] - (24 * 60 * 60 * 1000); // Subtract the extra day for correct end round
                const groupName = dataPoint.x; // "Braço X - Molde Y"
                const taskName = dataPoint.label; // "Cor"

                const calcRound = (ms) => {
                    const diffTime = new Date(ms).getTime() - baseDate.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays + 1;
                };

                const startRound = calcRound(startMs);
                const endRound = calcRound(endMs);
                const roundText = startRound === endRound ? `Rodada: R${startRound}` : `Rodadas: R${startRound} a R${endRound}`;

                return `<div class="p-2">
                            <strong>${groupName}</strong><br>
                            Cor: ${taskName}<br>
                            ${roundText}
                        </div>`;
            };

            chartInstances.rodadas = new ApexCharts(container, options);
            chartInstances.rodadas.render();
        } else if (allData.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-8">Sem dados para o gráfico de rodadas.</p>';
        } else {
        }
    }

    function processDataForMoldGantt(data) {
        const moldOccupation = {};

        data.forEach(item => {
            if (!item.Produto || !item.Braço || !item["Número da Rodada"]) return;

            const key = `${item.Produto} (Braço ${item.Braço})`; // This will be the Y-axis label
            const round = parseInt(item["Número da Rodada"], 10);
            if (isNaN(round)) return;

            if (!moldOccupation[key]) {
                moldOccupation[key] = new Set();
            }
            moldOccupation[key].add(round);
        });
        const baseDate = new Date('2024-01-01T00:00:00Z');

        const findContiguousBlocks = (numbers) => {
            if (!numbers || numbers.length === 0) return [];
            const sortedNumbers = [...numbers].sort((a, b) => a - b);
            const blocks = [];
            let start = sortedNumbers[0];
            let end = sortedNumbers[0];
            for (let i = 1; i < sortedNumbers.length; i++) {
                if (sortedNumbers[i] === end + 1) {
                    end = sortedNumbers[i];
                } else {
                    blocks.push({ start, end });
                    start = sortedNumbers[i];
                    end = sortedNumbers[i];
                }
            }
            blocks.push({ start, end });
            return blocks;
        };

        const ganttTasks = [];
        const sortedKeys = Object.keys(moldOccupation).sort(); // Sort alphabetically

        sortedKeys.forEach(key => {
            const rounds = Array.from(moldOccupation[key]);
            if (rounds.length === 0) return;

            const blocks = findContiguousBlocks(rounds);

            blocks.forEach(block => {
                const startDate = new Date(baseDate);
                startDate.setDate(baseDate.getDate() + block.start - 1);

                const endDate = new Date(baseDate);
                endDate.setDate(baseDate.getDate() + block.end - 1);

                ganttTasks.push({
                    x: key, // Y-axis label is "Molde (Braço X)"
                    y: [startDate.getTime(), endDate.getTime() + (24 * 60 * 60 * 1000)],
                    label: '', // No label on the bar, the Y-axis is enough
                    fillColor: 'var(--color-gantt-order)'
                });
            });
        });
        return ganttTasks;
    }

    function processDataForOrderGantt(data) {
        const tasksByOrder = {};

        data.forEach(item => {
            const orderId = `Pedido ${parseInt(item.Pedido)}`;
            const product = item.Produto;
            const date = item["Data Prevista"];
            if (!date || !product || !orderId) return;

            if (!tasksByOrder[orderId]) tasksByOrder[orderId] = {};
            if (!tasksByOrder[orderId][product]) tasksByOrder[orderId][product] = { dates: new Set(), originalOrderId: item.Pedido };

            tasksByOrder[orderId][product].dates.add(date);
        });

        const ganttTasks = [];
        Object.keys(tasksByOrder).sort().forEach(orderKey => {
            const productsInOrder = tasksByOrder[orderKey];
            Object.keys(productsInOrder).forEach(productKey => {
                const productData = productsInOrder[productKey];
                const dates = Array.from(productData.dates).sort((a, b) => new Date(convertDateFormat(a)) - new Date(convertDateFormat(b)));
                if (dates.length === 0) return;

                const startDate = new Date(convertDateFormat(dates[0]));
                const endDate = new Date(convertDateFormat(dates[dates.length - 1]));
                const isStockOrder = ["9999997", "9999998", "9999999"].includes(String(productData.originalOrderId));
                const fillColor = isStockOrder ? 'var(--color-gantt-stock)' : 'var(--color-gantt-order)';

                ganttTasks.push({
                    x: orderKey,
                    y: [startDate.getTime(), endDate.getTime() + (24 * 60 * 60 * 1000)],
                    label: productKey,
                    fillColor: fillColor
                });
            });
        });
        return ganttTasks;
    }

    function processDataForRoundGantt(data) {
        const tasksByArmAndMold = {};

        data.forEach(item => {
            if (!item.Produto || !item.Cor || !item["Número da Rodada"] || !item.Braço) return;

            const arm = `Braço ${item.Braço}`;
            const mold = item.Produto;
            const color = item.Cor;
            const round = parseInt(item["Número da Rodada"], 10);
            if (isNaN(round)) return;

            const armMoldKey = `${arm} - ${mold}`;

            if (!tasksByArmAndMold[armMoldKey]) tasksByArmAndMold[armMoldKey] = {};
            if (!tasksByArmAndMold[armMoldKey][color]) tasksByArmAndMold[armMoldKey][color] = new Set();

            tasksByArmAndMold[armMoldKey][color].add(round);
        });

        const baseDate = new Date('2024-01-01T00:00:00Z');

        const findContiguousBlocks = (numbers) => {
            if (!numbers || numbers.length === 0) return [];
            const sortedNumbers = [...numbers].sort((a, b) => a - b);
            const blocks = [];
            let start = sortedNumbers[0];
            let end = sortedNumbers[0];
            for (let i = 1; i < sortedNumbers.length; i++) {
                if (sortedNumbers[i] === end + 1) {
                    end = sortedNumbers[i];
                } else {
                    blocks.push({ start, end });
                    start = sortedNumbers[i];
                    end = sortedNumbers[i];
                }
            }
            blocks.push({ start, end });
            return blocks;
        };

        const ganttTasks = [];
        // Sort by arm then by mold for a structured view
        const sortedKeys = Object.keys(tasksByArmAndMold).sort((a, b) => {
            const [armA, ...moldA_parts] = a.split(' - ');
            const [armB, ...moldB_parts] = b.split(' - ');
            const moldA = moldA_parts.join(' - ');
            const moldB = moldB_parts.join(' - ');

            const armNumA = parseInt(armA.replace('Braço ', ''));
            const armNumB = parseInt(armB.replace('Braço ', ''));

            if (armNumA !== armNumB) return armNumA - armNumB;
            return moldA.localeCompare(moldB);
        });

        sortedKeys.forEach(armMoldKey => { // e.g., "Braço 1 - Produto A"
            const tasksByColor = tasksByArmAndMold[armMoldKey];

            Object.keys(tasksByColor).forEach(colorKey => { // e.g., "Cor X"
                const rounds = Array.from(tasksByColor[colorKey]);
                if (rounds.length === 0) return;

                const blocks = findContiguousBlocks(rounds);

                blocks.forEach(block => {
                    const startDate = new Date(baseDate);
                    startDate.setDate(baseDate.getDate() + block.start - 1);
                    const endDate = new Date(baseDate);
                    endDate.setDate(baseDate.getDate() + block.end - 1);

                    ganttTasks.push({
                        x: armMoldKey, // Y-axis label is "Braço X - Produto Y"
                        y: [startDate.getTime(), endDate.getTime() + (24 * 60 * 60 * 1000)],
                        label: colorKey, // Label on the bar is the Color
                        fillColor: 'var(--color-gantt-new)'
                    });
                });
            });
        });
        return ganttTasks;
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