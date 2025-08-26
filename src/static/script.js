document.addEventListener("DOMContentLoaded", () => {
    const loadingLayer = document.getElementById("loading-layer");
    const verHistoricoBtn = document.getElementById("ver-historico-btn");

    // Função para mostrar a layer de carregamento
    function mostrarLoading() {
        loadingLayer.classList.remove("hidden");
    }

    // Função para esconder a layer de carregamento
    function esconderLoading() {
        loadingLayer.classList.add("hidden");
    }

    esconderLoading();

    verHistoricoBtn.addEventListener("click", async () => {
        await carregarHistorico();
    });

    const setupFileInput = document.getElementById("setup-file");
    const faltasFileInput = document.getElementById("faltas-file");
    const cadastroMoldesFileInput = document.getElementById("cadastro-moldes-file");

    const setupStatus = document.getElementById("setup-status");
    const faltasStatus = document.getElementById("faltas-status");
    const cadastroStatus = document.getElementById("cadastro-status");

    const bracoSelecionadoInput = document.getElementById("braco-selecionado");
    const diasProgramacaoInput = document.getElementById("dias-programacao");
    const modoSequenciamentoInput = document.getElementById("modo-sequenciamento");
    const priorizacaoPedidosInput = document.getElementById("priorizacao-pedidos");

    const gerarProgramacaoBtn = document.getElementById("gerar-programacao-btn");
    const enviarSankhyaBtn = document.getElementById("enviar-sankhya-btn");
    const loadingMessage = document.getElementById("loading-message");
    const errorMessage = document.getElementById("error-message");
    const resultsSection = document.getElementById("results-section");

    const programacaoTableBody = document.getElementById("programacao-table").querySelector("tbody");
    const ociososTableBody = document.getElementById("ociosos-table").querySelector("tbody");
    const necessidadeTableBody = document.getElementById("necessidade-table").querySelector("tbody");

    const downloadProgramacaoLink = document.getElementById("download-programacao");
    const downloadOciososLink = document.getElementById("download-ociosos");
    const downloadNecessidadeLink = document.getElementById("download-necessidade");

    const noProgramacaoMsg = document.getElementById("no-programacao");
    const noOciososMsg = document.getElementById("no-ociosos");
    const noNecessidadeMsg = document.getElementById("no-necessidade");

    const graficosSection = document.getElementById("graficos-section");
    const tabelaPivotadaBody = document.getElementById("tabela-pivotada").querySelector("tbody");

    const filtroBraco = document.getElementById("filtro-braco");
    let dadosProgramacao = []; // Variável para armazenar os dados originais

    let setupFile = null;
    let faltasFile = null;
    let cadastroMoldesFile = null;

    let graficoProdutos = null;
    let graficoEvolucao = null;
    let graficoBracos = null;
    let graficoMoldesOciosos = null;
    let graficoMoldesPorBraco = null;
    let graficoMoldesSemDemanda = null;
    let graficoNecessidadeSemMoldes = null;
    let dadosOriginais = null;

    // Variáveis para controlar os filtros ativos
    let filtroBracoAtivo = null;
    let filtroProdutoAtivo = null;
    let filtroDataAtivo = null;

    const historicoAlerta = document.getElementById("historico-alerta");
    const historicoData = document.getElementById("historico-data");

    setupFileInput.addEventListener("change", (e) => {
        setupFile = e.target.files[0];
        setupStatus.textContent = setupFile ? `Arquivo selecionado: ${setupFile.name}` : "";
        if (setupFile) setupStatus.classList.remove("text-red-500"); setupStatus.classList.add("text-green-500");
    });

    faltasFileInput.addEventListener("change", (e) => {
        faltasFile = e.target.files[0];
        faltasStatus.textContent = faltasFile ? `Arquivo selecionado: ${faltasFile.name}` : "";
        if (faltasFile) faltasStatus.classList.remove("text-red-500"); faltasStatus.classList.add("text-green-500");
    });

    cadastroMoldesFileInput.addEventListener("change", (e) => {
        cadastroMoldesFile = e.target.files[0];
        cadastroStatus.textContent = cadastroMoldesFile ? `Arquivo selecionado: ${cadastroMoldesFile.name}` : "";
        if (cadastroMoldesFile) cadastroStatus.classList.remove("text-red-500"); cadastroStatus.classList.add("text-green-500");
    });

    async function uploadFile(file, url, statusElement) {
        if (!file) return true; // Permite upload opcional

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(url, {
                method: "POST",
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) {
                statusElement.textContent = `Erro: ${result.error || "Falha no upload"}`;
                statusElement.classList.add("text-red-500");
                statusElement.classList.remove("text-green-500");
                return false;
            }
            statusElement.textContent = result.message || "Upload com sucesso!";
            statusElement.classList.add("text-green-500");
            statusElement.classList.remove("text-red-500");
            return true;
        } catch (error) {
            statusElement.textContent = `Erro de rede: ${error.message}`;
            statusElement.classList.add("text-red-500");
            statusElement.classList.remove("text-green-500");
            return false;
        }
    }

    // Função para salvar dados no localStorage e no servidor
    async function salvarHistorico(dados) {
        

        // Salvar no servidor
        try {
            const response = await fetch("/api/programacao/salvar_programacao", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(dados),
            });

            const result = await response.json();

            if (!response.ok) {
                console.error("Erro ao salvar programação no servidor:", result.error);
                alert("Erro ao salvar programação no histórico do servidor. Os dados foram salvos apenas localmente.");
            } else {
                console.log("Programação salva com sucesso no servidor");
            }
        } catch (error) {
            console.error("Erro ao salvar programação no servidor:", error);
            alert("Erro ao salvar programação no histórico do servidor. Os dados foram salvos apenas localmente.");
        }
    }

    // Função para carregar dados do localStorage e do servidor
    async function carregarHistorico() {
        mostrarLoading(); // Mostrar loading ao carregar histórico

        let dados = null;
        let dataFormatada = null;
        let erroServidor = false;

        // Tentar carregar do servidor primeiro
        try {
            const response = await fetch("/api/programacao/obter_historico");
            const result = await response.json();

            if (response.ok && result.historico && result.historico.length > 0) {
                // Usar a programação mais recente do servidor
                const ultimaProgramacao = result.historico[0];
                dados = ultimaProgramacao;
                dataFormatada = new Date(ultimaProgramacao.timestamp).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                console.log("Histórico carregado com sucesso do servidor");
            } else {
                console.log("Nenhum histórico encontrado no servidor");
                erroServidor = true;
            }
        } catch (error) {
            console.error("Erro ao carregar histórico do servidor:", error);
            erroServidor = true;
        }

        

        if (dados) {
            historicoData.textContent = dataFormatada;
            historicoAlerta.classList.remove('hidden');

            if (erroServidor) {
                historicoAlerta.classList.add('bg-yellow-900');
                historicoAlerta.classList.remove('bg-red-900');
                historicoAlerta.querySelector('p').innerHTML = `
                    <span class="font-bold">Atenção:</span> Os dados que estão sendo exibidos são da última programação do dia 
                    <span class="font-semibold">${dataFormatada}</span>
                    <br>
                    <span class="text-yellow-200">(Carregado do cache local - não foi possível acessar o servidor)</span>
                `;
            } else {
                historicoAlerta.classList.add('bg-red-900');
                historicoAlerta.classList.remove('bg-yellow-900');
                historicoAlerta.querySelector('p').innerHTML = `
                    <span class="font-bold">Atenção:</span> Os dados que estão sendo exibidos são da última programação do dia 
                    <span class="font-semibold">${dataFormatada}</span>
                `;
            }

            // Mostrar seção de gráficos e resultados
            graficosSection.classList.remove("hidden");
            resultsSection.classList.remove("hidden");

            // Criar gráficos com os dados do histórico
            if (dados.programacao_data && dados.programacao_data.length > 0) {
                dadosOriginais = dados.programacao_data;
                criarGraficoProdutos(dados.programacao_data);
                criarGraficoEvolucao(dados.programacao_data);
                criarGraficoBracos(dados.programacao_data);
                // Passa dados.moldes_ociosos_data completos para calcular o tempo total
                criarGraficoMoldesPorBraco(dados.programacao_data, dados.moldes_ociosos_data);
                criarTabelaPivotada(dados.programacao_data);
            }

            if (dados.moldes_ociosos_data && dados.moldes_ociosos_data.length > 0) {
                criarGraficoMoldesOciosos(dados.moldes_ociosos_data);
                criarGraficoMoldesSemDemanda(dados.moldes_ociosos_data); // Agora já recebe dados completos e filtra internamente
                atualizarTempoTotal(dados.moldes_ociosos_data); // Recebe dados completos para o cálculo
            }

            if (dados.necessidade_sem_moldes_data && dados.necessidade_sem_moldes_data.length > 0) {
                criarGraficoNecessidadeSemMoldes(dados.necessidade_sem_moldes_data);
            }

            // Exibir tabelas originais
            displayTableData(programacaoTableBody, dados.programacao_data, ["Número da Rodada", "Data Prevista", "Braço", "Produto", "Cor", "Pedido", "CODPROD", "Quantidade de Moldes", "Quantidade Programada"], noProgramacaoMsg);
            displayTableData(ociososTableBody, dados.moldes_ociosos_data, ["Nome", "Quantidade", "Rodada Ociosa", "Braço"], noOciososMsg);
            displayTableData(necessidadeTableBody, dados.necessidade_sem_moldes_data, ["Nome", "Quantidade", "Qtd. Moldes Cadastrados"], noNecessidadeMsg);

            if (dados.programacao_gerada_url && dados.programacao_data.length > 0) {
                downloadProgramacaoLink.href = dados.programacao_gerada_url;
                downloadProgramacaoLink.classList.remove("hidden");
            }
            if (dados.moldes_ociosos_url && dados.moldes_ociosos_data.length > 0) {
                downloadOciososLink.href = dados.moldes_ociosos_url;
                downloadOciososLink.classList.remove("hidden");
            }
            if (dados.necessidade_sem_moldes_url && dados.necessidade_sem_moldes_data.length > 0) {
                downloadNecessidadeLink.href = dados.necessidade_sem_moldes_url;
                downloadNecessidadeLink.classList.remove("hidden");
            }
        }
        esconderLoading();
    }

    gerarProgramacaoBtn.addEventListener("click", async () => {
        // mostrarLoading(); // Mostrar loading no início do processamento do botão.
        loadingMessage.classList.remove("hidden");
        errorMessage.classList.add("hidden");
        errorMessage.textContent = "";
        resultsSection.classList.add("hidden");
        historicoAlerta.classList.add("hidden");
        gerarProgramacaoBtn.disabled = true;

        // Limpar tabelas e links de download anteriores
        programacaoTableBody.innerHTML = "";
        ociososTableBody.innerHTML = "";
        necessidadeTableBody.innerHTML = "";
        downloadProgramacaoLink.classList.add("hidden");
        downloadOciososLink.classList.add("hidden");
        downloadNecessidadeLink.classList.add("hidden");
        noProgramacaoMsg.classList.add("hidden");
        noOciososMsg.classList.add("hidden");
        noNecessidadeMsg.classList.add("hidden");

        if (!setupFile) {
            setupStatus.textContent = "Erro: Planilha de Setup é obrigatória.";
            setupStatus.classList.add("text-red-500");
            loadingMessage.classList.add("hidden");
            gerarProgramacaoBtn.disabled = false;
            esconderLoading(); // Esconder loading em caso de erro de validação.
            return;
        }
        if (!faltasFile) {
            faltasStatus.textContent = "Erro: Planilha de Faltas é obrigatória.";
            faltasStatus.classList.add("text-red-500");
            loadingMessage.classList.add("hidden");
            gerarProgramacaoBtn.disabled = false;
            esconderLoading(); // Esconder loading em caso de erro de validação.
            return;
        }

        const setupUploaded = await uploadFile(setupFile, "/api/programacao/upload_setup", setupStatus);
        if (!setupUploaded) {
            loadingMessage.classList.add("hidden");
            gerarProgramacaoBtn.disabled = false;
            esconderLoading(); // Esconder loading em caso de falha no upload.
            return;
        }

        const faltasUploaded = await uploadFile(faltasFile, "/api/programacao/upload_faltas", faltasStatus);
        if (!faltasUploaded) {
            loadingMessage.classList.add("hidden");
            gerarProgramacaoBtn.disabled = false;
            esconderLoading(); // Esconder loading em caso de falha no upload.
            return;
        }

        if (cadastroMoldesFile) {
            const cadastroUploaded = await uploadFile(cadastroMoldesFile, "/api/programacao/upload_cadastro_moldes", cadastroStatus);
            if (!cadastroUploaded) {
                loadingMessage.classList.add("hidden");
                gerarProgramacaoBtn.disabled = false;
                esconderLoading(); // Esconder loading em caso de falha no upload.
                return;
            }
        }

        const configData = {
            braco_selecionado: bracoSelecionadoInput.value,
            dias_programacao: parseInt(diasProgramacaoInput.value, 10),
            modo_sequenciamento: modoSequenciamentoInput.value,
            priorizacao_pedidos: priorizacaoPedidosInput.value,
        };

        try {
            const response = await fetch("/api/programacao/gerar_programacao", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(configData),
            });

            const result = await response.json();

            if (!response.ok) {
                errorMessage.textContent = `Erro ao gerar programação: ${result.error || "Detalhes não fornecidos."}`;
                errorMessage.classList.remove("hidden");
                loadingMessage.classList.add("hidden");
                gerarProgramacaoBtn.disabled = false;
                esconderLoading(); // Esconder loading em caso de erro da API.
                return;
            }

            // Salvar dados no histórico
            await salvarHistorico(result);

            // Atualizar a lista de histórico
            await atualizarListaHistorico();

            // Mostrar seção de gráficos e resultados
            graficosSection.classList.remove("hidden");
            resultsSection.classList.remove("hidden");

            // Armazenar dados originais
            dadosOriginais = result;

            // Mostrar botão do Sankhya após gerar programação
            enviarSankhyaBtn.classList.remove("hidden");

            // Criar gráficos
            if (result.programacao_data && result.programacao_data.length > 0) {
                criarGraficoProdutos(result.programacao_data);
                criarGraficoEvolucao(result.programacao_data);
                criarGraficoBracos(result.programacao_data);
                criarGraficoMoldesPorBraco(result.programacao_data, result.moldes_ociosos_data); // Passa dados.moldes_ociosos_data completos
                criarTabelaPivotada(result.programacao_data);
            }

            if (result.moldes_ociosos_data && result.moldes_ociosos_data.length > 0) {
                criarGraficoMoldesOciosos(result.moldes_ociosos_data);
                criarGraficoMoldesSemDemanda(result.moldes_ociosos_data);
                atualizarTempoTotal(result.moldes_ociosos_data); // Recebe dados completos para o cálculo
            }

            if (result.necessidade_sem_moldes_data && result.necessidade_sem_moldes_data.length > 0) {
                criarGraficoNecessidadeSemMoldes(result.necessidade_sem_moldes_data);
            }

            // Exibir tabelas originais
            displayTableData(programacaoTableBody, result.programacao_data, ["Número da Rodada", "Data Prevista", "Braço", "Produto", "Cor", "Pedido", "CODPROD", "Quantidade de Moldes", "Quantidade Programada"], noProgramacaoMsg);
            displayTableData(ociososTableBody, result.moldes_ociosos_data, ["Nome", "Quantidade", "Rodada Ociosa", "Braço"], noOciososMsg);
            displayTableData(necessidadeTableBody, result.necessidade_sem_moldes_data, ["Nome", "Quantidade", "Qtd. Moldes Cadastrados"], noNecessidadeMsg);

            if (result.programacao_gerada_url && result.programacao_data.length > 0) {
                downloadProgramacaoLink.href = result.programacao_gerada_url;
                downloadProgramacaoLink.classList.remove("hidden");
            }
            if (result.moldes_ociosos_url && result.moldes_ociosos_data.length > 0) {
                downloadOciososLink.href = result.moldes_ociosos_url;
                downloadOciososLink.classList.remove("hidden");
            }
            if (result.necessidade_sem_moldes_url && result.necessidade_sem_moldes_data.length > 0) {
                downloadNecessidadeLink.href = result.necessidade_sem_moldes_url;
                downloadNecessidadeLink.classList.remove("hidden");
            }

        } catch (error) {
            errorMessage.textContent = `Erro de rede ao gerar programação: ${error.message}`;
            errorMessage.classList.remove("hidden");
        } finally {
            loadingMessage.classList.add("hidden");
            gerarProgramacaoBtn.disabled = false;
            esconderLoading(); // Garante que o loading é escondido no final, mesmo em erro.
        }
    });

    // Event listener para o botão Enviar para o Sankhya
    enviarSankhyaBtn.addEventListener("click", async () => {
        // Verificar se há dados de programação disponíveis
        if (!dadosOriginais || !dadosOriginais.programacao_data || dadosOriginais.programacao_data.length === 0) {
            alert("Erro: Nenhuma programação foi gerada ainda. Por favor, gere uma programação primeiro.");
            return;
        }

        // Mostrar caixa de confirmação
        const confirmacao = confirm("Deseja realmente enviar este planejamento para o Sankhya?\n\nApenas os dados dos 3 primeiros dias serão enviados para o banco de dados Oracle.");

        if (!confirmacao) {
            return;
        }

        // Desabilitar o botão durante o envio
        enviarSankhyaBtn.disabled = true;
        enviarSankhyaBtn.textContent = "Enviando...";
        //mostrarLoading(); // Mostrar loading ao enviar para o Sankhya.

        try {
            const response = await fetch("/api/programacao/enviar_sankhya", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    programacao_data: dadosOriginais.programacao_data
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert(`Sucesso! ${result.message}\n\nRegistros inseridos: ${result.registros_inseridos}\nRegistros com erro: ${result.registros_com_erro}\nTotal processado: ${result.total_registros_processados}`);
            } else {
                alert(`Erro ao enviar para o Sankhya: ${result.error || "Erro desconhecido"}`);
            }
        } catch (error) {
            alert(`Erro de rede ao enviar para o Sankhya: ${error.message}`);
        } finally {
            // Reabilitar o botão
            enviarSankhyaBtn.disabled = false;
            enviarSankhyaBtn.textContent = "Enviar para o Sankhya";
            //esconderLoading(); // Esconder loading após o envio para o Sankhya.
        }
    });

    function displayTableData(tbody, data, columns, noDataMsgElement) {
        tbody.innerHTML = ""; // Clear previous data
        if (!data || data.length === 0) {
            noDataMsgElement.classList.remove("hidden");
            return;
        }
        noDataMsgElement.classList.add("hidden");

        // Ordenar e filtrar dados para a tabela de necessidade sem moldes
        let dadosProcessados = [...data];
        if (columns.includes("Qtd. Moldes Cadastrados")) {
            // Filtrar itens com quantidade de moldes maior que 0
            dadosProcessados = dadosProcessados.filter(item => item["Qtd. Moldes Cadastrados"] > 0);
            // Ordenar por quantidade do maior para o menor
            dadosProcessados.sort((a, b) => b["Quantidade"] - a["Quantidade"]);
        }

        dadosProcessados.forEach(rowData => {
            const tr = document.createElement("tr");
            tr.className = "bg-gray-800 border-b border-gray-700 hover:bg-gray-600";
            columns.forEach(col => {
                const td = document.createElement("td");
                td.className = "px-4 py-2 font-medium text-gray-300 whitespace-nowrap";
                // Handle cases where a column might be missing in some rows or has a different key in the JSON vs the display name
                let cellValue = "";
                if (col === "Número da Rodada") cellValue = rowData["Número da Rodada"];
                else if (col === "Data Prevista") cellValue = rowData["Data Prevista"];
                else if (col === "Braço") cellValue = rowData["Braço"];
                else if (col === "Produto") cellValue = rowData["Produto"];
                else if (col === "Cor") cellValue = rowData["Cor"];
                else if (col === "Pedido") cellValue = rowData["Pedido"];
                else if (col === "CODPROD") cellValue = rowData["CODPROD"];
                else if (col === "Quantidade de Moldes") cellValue = rowData["Quantidade de Moldes"];
                else if (col === "Quantidade Programada") cellValue = rowData["Quantidade Programada"];
                else if (col === "Nome") cellValue = rowData["Nome"];
                else if (col === "Quantidade") cellValue = rowData["Quantidade"];
                else if (col === "Rodada Ociosa") cellValue = rowData["Rodada Ociosa"];
                else if (col === "Qtd. Moldes Cadastrados") cellValue = rowData["Qtd. Moldes Cadastrados"];

                td.textContent = cellValue !== undefined && cellValue !== null ? cellValue : "-";
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        // Se após o processamento não houver dados, mostrar mensagem
        if (dadosProcessados.length === 0) {
            noDataMsgElement.classList.remove("hidden");
        }
    }

    // Funções para criar os gráficos
    function criarGraficoProdutos(dados, filtroBraco = null, filtroData = null) {
        const ctx = document.getElementById('graficoProdutos').getContext('2d');

        // Filtrar dados se necessário
        let dadosFiltrados = dados;
        if (filtroBraco) {
            dadosFiltrados = dadosFiltrados.filter(item => item.Braço === filtroBraco);
        }
        if (filtroData) {
            dadosFiltrados = dadosFiltrados.filter(item => item["Data Prevista"] === filtroData);
        }

        const produtos = [...new Set(dadosFiltrados.map(item => item.Produto))];
        const quantidades = produtos.map(produto =>
            dadosFiltrados.filter(item => item.Produto === produto)
                .reduce((sum, item) => sum + item["Quantidade Programada"], 0)
        );

        if (graficoProdutos) {
            graficoProdutos.destroy();
        }

        // Criar array de cores com base no produto selecionado
        const cores = produtos.map(produto => {
            if (produto === filtroProdutoAtivo) {
                return 'rgba(34, 197, 94, 0.8)'; // Cor mais intensa para o produto selecionado
            }
            return 'rgba(34, 197, 94, 0.5)'; // Cor normal para os outros produtos
        });

        // Criar texto do subtítulo baseado nos filtros ativos
        let subtitulo = '';
        if (filtroBraco || filtroData) {
            subtitulo = 'Filtro ativo: ';
            if (filtroBraco) {
                subtitulo += `Braço ${filtroBraco}`;
            }
            if (filtroBraco && filtroData) {
                subtitulo += ' e ';
            }
            if (filtroData) {
                subtitulo += `Data ${filtroData}`;
            }
        }

        graficoProdutos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: produtos,
                datasets: [{
                    label: filtroBraco ? `Quantidade Programada (Braço ${filtroBraco})` : 'Quantidade Programada',
                    data: quantidades,
                    backgroundColor: cores,
                    borderColor: cores.map(cor => cor.replace('0.5', '1').replace('0.8', '1')),
                    borderWidth: 1,
                    hoverBackgroundColor: 'rgba(34, 197, 94, 0.8)',
                    hoverBorderColor: 'rgba(34, 197, 94, 1)'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: 'white'
                        }
                    },
                    title: {
                        display: true,
                        text: [
                            'Quantidade Programada por Produto',
                            subtitulo
                        ],
                        color: 'white',
                        font: {
                            size: 16
                        },
                        padding: {
                            bottom: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const produto = context.label;
                                // Filtra os dados para o produto do ponto
                                const dadosProduto = dadosFiltrados.filter(item => item.Produto === produto);
                                let estoque = 0;
                                let pedido = 0;
                                dadosProduto.forEach(item => {
                                    const numPedido = String(item.Pedido);
                                    if (["9999997", "9999998", "9999999"].includes(numPedido)) {
                                        estoque += item["Quantidade Programada"];
                                    } else {
                                        pedido += item["Quantidade Programada"];
                                    }
                                });
                                // Calcular percentuais
                                const total = estoque + pedido;
                                let partes = [];
                                if (estoque > 0) {
                                    const percEstoque = total > 0 ? ((estoque / total) * 100).toFixed(1) : 0;
                                    partes.push(`ESTOQUE: ${estoque} (${percEstoque}%)`);
                                }
                                if (pedido > 0) {
                                    const percPedido = total > 0 ? ((pedido / total) * 100).toFixed(1) : 0;
                                    partes.push(`PEDIDO: ${pedido} (${percPedido}%)`);
                                }

                                return partes.length > 0 ? partes.join(' \n ') : 'Sem produção';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const produto = produtos[index];

                        // Toggle do filtro de produto
                        if (filtroProdutoAtivo === produto) {
                            filtroProdutoAtivo = null;
                        } else {
                            filtroProdutoAtivo = produto;
                        }

                        // Atualizar outros gráficos
                        atualizarGraficoBracos(dados, filtroProdutoAtivo);
                        atualizarGraficoEvolucao(dados, filtroBracoAtivo, filtroProdutoAtivo);

                        // Recriar o gráfico para atualizar as cores
                        criarGraficoProdutos(dados, filtroBraco, filtroData);
                    }
                }
            }
        });
    }

    function criarGraficoEvolucao(dados, filtroBraco = null, filtroProduto = null) {
        const ctx = document.getElementById('graficoEvolucao').getContext('2d');

        // Filtrar dados se necessário
        let dadosFiltrados = dados;
        if (filtroBraco) {
            dadosFiltrados = dadosFiltrados.filter(item => item.Braço === filtroBraco);
        }
        if (filtroProduto) {
            dadosFiltrados = dadosFiltrados.filter(item => item.Produto === filtroProduto);
        }

        // Obter datas únicas e ordenar em ordem crescente
        const datas = [...new Set(dadosFiltrados.map(item => item["Data Prevista"]))]
            .sort((a, b) => new Date(a) - new Date(b));

        const quantidades = datas.map(data =>
            dadosFiltrados.filter(item => item["Data Prevista"] === data)
                .reduce((sum, item) => sum + item["Quantidade Programada"], 0)
        );

        if (graficoEvolucao) {
            graficoEvolucao.destroy();
        }

        // Criar array de pontos com base na data selecionada
        const pontos = datas.map(data => {
            if (data === filtroDataAtivo) {
                return {
                    radius: 6,
                    hoverRadius: 8,
                    backgroundColor: 'rgba(59, 130, 246, 1)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 2
                };
            }
            return {
                radius: 4,
                hoverRadius: 6,
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            };
        });

        // Criar texto do subtítulo baseado nos filtros ativos
        let subtitulo = '';
        if (filtroBraco || filtroProduto) {
            subtitulo = 'Filtro ativo: ';
            if (filtroBraco) {
                subtitulo += `Braço ${filtroBraco}`;
            }
            if (filtroBraco && filtroProduto) {
                subtitulo += ' e ';
            }
            if (filtroProduto) {
                subtitulo += `Produto ${filtroProduto}`;
            }
        }

        graficoEvolucao = new Chart(ctx, {
            type: 'line',
            data: {
                labels: datas,
                datasets: [{
                    label: 'Quantidade Programada',
                    data: quantidades,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: pontos.map(p => p.backgroundColor),
                    pointBorderColor: pontos.map(p => p.borderColor),
                    pointBorderWidth: pontos.map(p => p.borderWidth),
                    pointRadius: pontos.map(p => p.radius),
                    pointHoverRadius: pontos.map(p => p.hoverRadius),
                    pointHoverBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: 'white'
                        }
                    },
                    title: {
                        display: true,
                        text: [
                            'Evolução da Quantidade Programada por Data',
                            subtitulo
                        ],
                        color: 'white',
                        font: {
                            size: 16
                        },
                        padding: {
                            bottom: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                // Recupera a data do ponto
                                const data = context.label;
                                // Filtra os dados para a data do ponto
                                const dadosNaData = dadosFiltrados.filter(item => item["Data Prevista"] === data);
                                // Soma as quantidades por tipo de pedido
                                let estoque = 0;
                                let pedido = 0;
                                dadosNaData.forEach(item => {
                                    const numPedido = String(item.Pedido);
                                    if (["9999997", "9999998", "9999999"].includes(numPedido)) {
                                        estoque += item["Quantidade Programada"];
                                    } else {
                                        pedido += item["Quantidade Programada"];
                                    }
                                });
                                // Calcular percentuais
                                const total = estoque + pedido;
                                let partes = [];
                                if (estoque > 0) {
                                    const percEstoque = total > 0 ? ((estoque / total) * 100).toFixed(1) : 0;
                                    partes.push(`ESTOQUE: ${estoque} (${percEstoque}%)`);
                                }
                                if (pedido > 0) {
                                    const percPedido = total > 0 ? ((pedido / total) * 100).toFixed(1) : 0;
                                    partes.push(`PEDIDO: ${pedido} (${percPedido}%)`);
                                }
                                return partes.length > 0 ? partes.join(' \n ') : 'Sem produção';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const data = datas[index];

                        // Toggle do filtro de data
                        if (filtroDataAtivo === data) {
                            filtroDataAtivo = null;
                        } else {
                            filtroDataAtivo = data;
                        }

                        // Atualizar outros gráficos
                        atualizarGraficoProdutos(dados, filtroBracoAtivo, filtroDataAtivo);

                        // Recriar o gráfico para atualizar os pontos
                        criarGraficoEvolucao(dados, filtroBraco, filtroProduto);
                    }
                }
            }
        });
    }

    function criarGraficoBracos(dados, filtroProduto = null) {
        const ctx = document.getElementById('graficoBracos').getContext('2d');

        // Filtrar dados se necessário
        let dadosFiltrados = dados;
        if (filtroProduto) {
            dadosFiltrados = dadosFiltrados.filter(item => item.Produto === filtroProduto);
        }

        const bracos = [...new Set(dadosFiltrados.map(item => item.Braço))];
        const quantidades = bracos.map(braco =>
            dadosFiltrados.filter(item => item.Braço === braco)
                .reduce((sum, item) => sum + item["Quantidade Programada"], 0)
        );

        const total = quantidades.reduce((a, b) => a + b, 0);

        if (graficoBracos) {
            graficoBracos.destroy();
        }

        // Definir cores base
        const coresBase = [
            'rgba(234, 179, 8, 0.5)',   // yellow-500
            'rgba(234, 88, 12, 0.5)',   // orange-600
            'rgba(168, 85, 247, 0.5)',  // purple-500
            'rgba(59, 130, 246, 0.5)',  // blue-500
            'rgba(34, 197, 94, 0.5)',   // green-500
            'rgba(239, 68, 68, 0.5)'    // red-500
        ];

        // Criar array de cores com base no braço selecionado
        const cores = bracos.map((braco, index) => {
            if (braco === filtroBracoAtivo) {
                return coresBase[index].replace('0.5', '0.8'); // Cor mais intensa para o braço selecionado
            }
            return coresBase[index]; // Cor normal para os outros braços
        });

        // Criar array de cores de borda
        const coresBorda = cores.map(cor => cor.replace('0.5', '1').replace('0.8', '1'));

        // Criar texto do subtítulo baseado nos filtros ativos
        let subtitulo = '';
        if (filtroProduto) {
            subtitulo = `Filtro ativo: Produto ${filtroProduto}`;
        }

        graficoBracos = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: bracos.map(b => `Braço ${b}`),
                datasets: [{
                    data: quantidades,
                    backgroundColor: cores,
                    borderColor: coresBorda,
                    borderWidth: 1,
                    hoverBackgroundColor: cores.map(cor => cor.replace('0.5', '0.8').replace('0.8', '0.8')),
                    hoverBorderColor: coresBorda
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: 'white'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    },
                    datalabels: {
                        color: 'white',
                        font: {
                            size: 12
                        },
                        formatter: function (value, context) {
                            const percentage = Math.round((value / total) * 100);
                            return `${value}\n(${percentage}%)`;
                        },
                        anchor: 'center',
                        align: 'center',
                        offset: 0,
                        textAlign: 'center',
                        padding: {
                            top: 5,
                            bottom: 5
                        },
                        display: function (context) {
                            return context.dataset.data[context.dataIndex] > 0;
                        }
                    },
                    title: {
                        display: true,
                        text: [
                            'Distribuição Total de Produtos por Braço',
                            subtitulo
                        ],
                        color: 'white',
                        font: {
                            size: 16
                        },
                        padding: {
                            bottom: 10
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const braco = bracos[index];

                        // Toggle do filtro de braço
                        if (filtroBracoAtivo === braco) {
                            filtroBracoAtivo = null;
                        } else {
                            filtroBracoAtivo = braco;
                        }

                        // Filtrar produtos do braço selecionado
                        const produtosDoBraco = new Set();
                        Object.entries(moldesPorProdutoBraco).forEach(([chave, quantidade]) => {
                            const [produto, bracoProduto] = chave.split('-');
                            if (bracoProduto === filtroBracoAtivo) {
                                produtosDoBraco.add(produto);
                            }
                        });

                        // Atualizar o gráfico de produtos com os produtos do braço selecionado
                        if (dadosOriginais) {
                            const dadosFiltrados = filtroBracoAtivo
                                ? dadosOriginais.programacao_data.filter(item => produtosDoBraco.has(item.Produto))
                                : dadosOriginais.programacao_data;
                            criarGraficoProdutos(dadosFiltrados);
                        }

                        // Recriar o gráfico para atualizar as cores
                        criarGraficoBracos(dados, filtroProduto);
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    function criarGraficoMoldesOciosos(dados) {
        const ctx = document.getElementById('graficoMoldesOciosos').getContext('2d');
        // Filtrar apenas moldes ociosos que são da rodada 1 OU que estão marcados como "Desde o início"
        const dadosRodada1OuDesdeInicio = dados.filter(item =>
            item["Rodada Ociosa"] === 1 || item["Rodada Ociosa"] === "Desde o início (sem demanda ou uso)"
        );
        const bracos = [...new Set(dadosRodada1OuDesdeInicio.map(item => item.Braço))];
        const quantidades = bracos.map(braco =>
            dadosRodada1OuDesdeInicio.filter(item => item.Braço === braco)
                .reduce((sum, item) => sum + item.Quantidade, 0)
        );

        if (graficoMoldesOciosos) {
            graficoMoldesOciosos.destroy();
        }

        // Criar array de cores com base no braço selecionado
        const cores = bracos.map(braco => {
            if (braco === filtroBracoAtivo) {
                return 'rgba(239, 68, 68, 0.8)'; // Cor mais intensa para o braço selecionado
            }
            return 'rgba(239, 68, 68, 0.5)'; // Cor normal para os outros braços
        });

        // Criar texto do subtítulo baseado nos filtros ativos
        let subtitulo = '';
        if (filtroBracoAtivo) {
            subtitulo = `Filtro ativo: Braço ${filtroBracoAtivo}`;
        }

        graficoMoldesOciosos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: bracos.map(b => `Braço ${b}`),
                datasets: [{
                    label: 'Moldes Ociosos (Rodada 1 / Desde o Início)', // Atualiza o label
                    data: quantidades,
                    backgroundColor: cores,
                    borderColor: cores.map(cor => cor.replace('0.5', '1').replace('0.8', '1')),
                    borderWidth: 1,
                    hoverBackgroundColor: 'rgba(239, 68, 68, 0.8)',
                    hoverBorderColor: 'rgba(239, 68, 68, 1)'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: 'white'
                        }
                    },
                    title: {
                        display: true,
                        text: [
                            'Moldes Ociosos por Braço (Rodada 1 / Desde o Início)', // Atualiza o título
                            subtitulo
                        ],
                        color: 'white',
                        font: {
                            size: 16
                        },
                        padding: {
                            bottom: 10
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const braco = bracos[index];

                        // Toggle do filtro de braço
                        if (filtroBracoAtivo === braco) {
                            filtroBracoAtivo = null;
                        } else {
                            filtroBracoAtivo = braco;
                        }

                        // Atualizar o gráfico de produtos (dadosOriginais.programacao_data contém os dados completos)
                        if (dadosOriginais && dadosOriginais.programacao_data) {
                            atualizarGraficoProdutos(dadosOriginais.programacao_data, filtroBracoAtivo, filtroDataAtivo);
                        }

                        // Atualizar o gráfico de moldes sem demanda (passa os dados originais de moldes ociosos)
                        criarGraficoMoldesSemDemanda(dados, filtroBracoAtivo); // Passa os dados 'dados' completos para a função

                        // Recriar o gráfico para atualizar as cores
                        criarGraficoMoldesOciosos(dados); // Passa os dados 'dados' completos para a função
                    }
                }
            }
        });
    }

    function criarGraficoMoldesPorBraco(dados, dadosOciosos) {
        const ctx = document.getElementById('graficoMoldesPorBraco').getContext('2d');

        // Filtrar apenas dados da primeira rodada
        const dadosRodada1 = dados.filter(item => item["Número da Rodada"] === 1);

        // Agrupar dados por produto e braço para encontrar o máximo de moldes por produto
        const moldesPorProdutoBraco = {};
        dadosRodada1.forEach(item => {
            const produto = item.Produto;
            const braco = item.Braço;
            const chave = `${produto}-${braco}`;

            if (!moldesPorProdutoBraco[chave]) {
                moldesPorProdutoBraco[chave] = 0;
            }

            // Atualizar o máximo de moldes se necessário
            if (item["Quantidade de Moldes"] > moldesPorProdutoBraco[chave]) {
                moldesPorProdutoBraco[chave] = item["Quantidade de Moldes"];
            }
        });

        // Calcular a soma dos máximos por braço (moldes instalados)
        const moldesPorBraco = {};
        Object.entries(moldesPorProdutoBraco).forEach(([chave, quantidade]) => {
            const braco = chave.split('-')[1];
            if (!moldesPorBraco[braco]) {
                moldesPorBraco[braco] = 0;
            }
            moldesPorBraco[braco] += quantidade;
        });

        // Adicionar moldes ociosos por braço que são "Desde o início (sem demanda ou uso)"
        if (dadosOciosos) {
            const dadosOciososDesdeInicio = dadosOciosos.filter(item => item["Rodada Ociosa"] === "Desde o início (sem demanda ou uso)");
            dadosOciososDesdeInicio.forEach(item => {
                const braco = item.Braço;
                if (!moldesPorBraco[braco]) {
                    moldesPorBraco[braco] = 0;
                }
                moldesPorBraco[braco] += item.Quantidade;
            });
        }

        // Preparar dados para o gráfico
        const bracos = Object.keys(moldesPorBraco).sort((a, b) => a - b);
        const quantidades = bracos.map(braco => moldesPorBraco[braco]);
        const total = quantidades.reduce((a, b) => a + b, 0);

        // Atualizar o elemento HTML com o total de moldes
        document.getElementById('total-moldes').textContent = total;

        if (graficoMoldesPorBraco) {
            graficoMoldesPorBraco.destroy();
        }

        // Definir cores base para cada braço
        const coresBase = [
            'rgba(147, 51, 234, 0.5)',  // purple-600
            'rgba(79, 70, 229, 0.5)',   // indigo-600
            'rgba(59, 130, 246, 0.5)',  // blue-500
            'rgba(16, 185, 129, 0.5)',  // emerald-500
            'rgba(245, 158, 11, 0.5)',  // amber-500
            'rgba(239, 68, 68, 0.5)'    // red-500
        ];

        // Criar array de cores com base no braço selecionado
        const cores = bracos.map((braco, index) => {
            if (braco === filtroBracoAtivo) {
                return coresBase[index].replace('0.5', '0.8'); // Cor mais intensa para o braço selecionado
            }
            return coresBase[index]; // Cor normal para os outros braços
        });

        graficoMoldesPorBraco = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: bracos.map(b => `Braço ${b}`),
                datasets: [{
                    data: quantidades,
                    backgroundColor: cores,
                    borderColor: cores.map(cor => cor.replace('0.5', '1').replace('0.8', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: 'white'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                // Extrai o número do braço do label (ex: "Braço 1" => "1")
                                const label = context.label || '';
                                const braco = label.replace('Braço ', '');

                                // Filtra os dados da rodada 1 para o braço selecionado
                                const dadosRodada1 = dados.filter(item => item["Número da Rodada"] === 1 && String(item.Braço) === String(braco));

                                let estoque = 0;
                                let pedido = 0;
                                dadosRodada1.forEach(item => {
                                    const numPedido = String(item.Pedido);
                                    if (["9999997", "9999998", "9999999"].includes(numPedido)) {
                                        estoque += item["Quantidade de Moldes"];
                                    } else {
                                        pedido += item["Quantidade de Moldes"];
                                    }
                                });

                                // Calcular percentuais
                                const total = estoque + pedido;
                                let partes = [];
                                if (estoque > 0) {
                                    const percEstoque = total > 0 ? ((estoque / total) * 100).toFixed(1) : 0;
                                    partes.push(`ESTOQUE: ${estoque} (${percEstoque}%)`);
                                }
                                if (pedido > 0) {
                                    const percPedido = total > 0 ? ((pedido / total) * 100).toFixed(1) : 0;
                                    partes.push(`PEDIDO: ${pedido} (${percPedido}%)`);
                                }
                                return partes.length > 0 ? partes.join(' \n ') : 'Sem moldes';
                            }
                        }
                    },
                    datalabels: {
                        color: 'white',
                        font: {
                            size: 12
                        },
                        formatter: function (value, context) {
                            const percentage = Math.round((value / total) * 100);
                            return `${value}\n(${percentage}%)`;
                        },
                        anchor: 'center',
                        align: 'center',
                        offset: 0,
                        textAlign: 'center',
                        padding: {
                            top: 5,
                            bottom: 5
                        },
                        display: function (context) {
                            return context.dataset.data[context.dataIndex] > 0;
                        }
                    },
                    title: {
                        display: true,
                        text: 'Quantidade Total de Moldes por Braço (Rodada 1)',
                        color: 'white',
                        font: {
                            size: 16
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const braco = bracos[index];

                        // Toggle do filtro de braço
                        if (filtroBracoAtivo === braco) {
                            filtroBracoAtivo = null;
                        } else {
                            filtroBracoAtivo = braco;
                        }

                        // Filtrar produtos do braço selecionado
                        const produtosDoBraco = new Set();
                        Object.entries(moldesPorProdutoBraco).forEach(([chave, quantidade]) => {
                            const [produto, bracoProduto] = chave.split('-');
                            if (bracoProduto === filtroBracoAtivo) {
                                produtosDoBraco.add(produto);
                            }
                        });

                        // Atualizar o gráfico de produtos com os produtos do braço selecionado
                        if (dadosOriginais) {
                            const dadosFiltrados = filtroBracoAtivo
                                ? dadosOriginais.programacao_data.filter(item => produtosDoBraco.has(item.Produto))
                                : dadosOriginais.programacao_data;
                            criarGraficoProdutos(dadosFiltrados);
                        }

                        // Recriar o gráfico para atualizar as cores
                        criarGraficoMoldesPorBraco(dados, dadosOciosos);
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    function atualizarTempoTotal(dados, filtroBraco = null) {
        // Filtrar moldes ociosos que são da rodada 1 OU que estão marcados como "Desde o início"
        let dadosOciososParaCalculo = dados.filter(item =>
            item["Rodada Ociosa"] === 1 || item["Rodada Ociosa"] === "Desde o início (sem demanda ou uso)"
        );

        // Aplicar filtro de braço se necessário
        if (filtroBraco) {
            dadosOciososParaCalculo = dadosOciososParaCalculo.filter(item => item.Braço === filtroBraco);
        }

        // Calcular o total de segundos (30 segundos por molde)
        const totalSegundos = dadosOciososParaCalculo.reduce((total, item) => total + (item.Quantidade * 30), 0);

        // Converter para horas e minutos
        const horas = Math.floor(totalSegundos / 3600);
        const minutos = Math.floor((totalSegundos % 3600) / 60);

        // Formatar o tempo como HH:MM
        const tempoFormatado = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;

        // Atualizar o elemento HTML do tempo por rodada
        document.getElementById('tempo-total').textContent = tempoFormatado;

        // Calcular o tempo total por dia (multiplicado pelo número máximo de rodadas)
        const maxRodadas = 12; // Número máximo de rodadas por dia
        const totalSegundosDia = totalSegundos * maxRodadas;

        // Converter para horas e minutos
        const horasDia = Math.floor(totalSegundosDia / 3600);
        const minutosDia = Math.floor((totalSegundosDia % 3600) / 60);

        // Formatar o tempo como HH:MM
        const tempoFormatadoDia = `${horasDia.toString().padStart(2, '0')}:${minutosDia.toString().padStart(2, '0')}`;

        // Atualizar o elemento HTML do tempo total por dia
        document.getElementById('tempo-total-dia').textContent = tempoFormatadoDia;
    }

    function criarGraficoMoldesSemDemanda(dados, filtroBraco = null) {
        const ctx = document.getElementById('graficoMoldesSemDemanda').getContext('2d');

        // Filtrar apenas dados onde "Rodada Ociosa" é "Desde o início (sem demanda ou uso)"
        let dadosFiltradosParaGrafico = dados.filter(item => item["Rodada Ociosa"] === "Desde o início (sem demanda ou uso)");

        // Aplicar filtro de braço se necessário
        if (filtroBraco) {
            dadosFiltradosParaGrafico = dadosFiltradosParaGrafico.filter(item => item.Braço === filtroBraco);
        }

        // Ordenar por quantidade (maior para menor)
        const dadosOrdenados = dadosFiltradosParaGrafico.sort((a, b) => b.Quantidade - a.Quantidade);

        // Separar nomes e quantidades
        const nomes = dadosOrdenados.map(item => item.Nome);
        const quantidades = dadosOrdenados.map(item => item.Quantidade);

        if (graficoMoldesSemDemanda) {
            graficoMoldesSemDemanda.destroy();
        }

        // Criar texto do subtítulo baseado nos filtros ativos
        let subtitulo = '';
        if (filtroBraco) {
            subtitulo = `Filtro ativo: Braço ${filtroBraco}`;
        }

        graficoMoldesSemDemanda = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: nomes,
                datasets: [{
                    label: filtroBraco ? `Quantidade de Moldes Sem Demanda (Braço ${filtroBraco})` : 'Quantidade de Moldes Sem Demanda (Desde o Início)', // Atualiza o label
                    data: quantidades,
                    backgroundColor: 'rgba(220, 38, 38, 0.5)', // red-600
                    borderColor: 'rgba(220, 38, 38, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: 'white'
                        }
                    },
                    title: {
                        display: true,
                        text: [
                            'Moldes Sem Demanda (Desde o Início)', // Atualiza o título
                            subtitulo
                        ],
                        color: 'white',
                        font: {
                            size: 16
                        },
                        padding: {
                            bottom: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `Quantidade: ${Math.round(context.raw)}`;
                            }
                        }
                    },
                    datalabels: {
                        color: 'white',
                        font: {
                            size: 12
                        },
                        formatter: function (value) {
                            return Math.round(value);
                        },
                        anchor: 'end',
                        align: 'end',
                        offset: 4
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'white',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });

        // Atualizar o tempo total (agora já filtrado dentro da função)
        // Note: Se esta função for apenas para Moldes Sem Demanda, e atualizarTempoTotal
        // calcula ociosos gerais, talvez seja melhor chamar atualizarTempoTotal separadamente
        // ou ajustar a lógica de filtro dentro dela.
        // Por enquanto, mantenho a chamada para garantir que o tempo de moldes sem demanda (que é um subconjunto de ociosos)
        // seja considerado no cálculo do tempo total se essa for a intenção.
        // Se o tempo total for APENAS para os moldes ociosos "desde o início", esta chamada é correta.
        // Se for para moldes ociosos de qualquer rodada, a função atualizarTempoTotal precisa receber todos os dados de ociosos.
        // Assumo que 'dados' aqui é o objeto completo de moldes ociosos.
        atualizarTempoTotal(dados, filtroBraco);
    }

    function criarTabelaPivotada(dados) {
        dadosProgramacao = dados; // Armazenar dados originais
        tabelaPivotadaBody.innerHTML = '';

        // Filtrar dados por braço se necessário
        const bracoSelecionado = filtroBraco.value;
        const dadosFiltrados = bracoSelecionado === 'todos'
            ? dados
            : dados.filter(item => item.Braço.toString() === bracoSelecionado);

        // Agrupar dados por Braço, Produto, Cor e Quantidade de Moldes
        const grupos = {};
        dadosFiltrados.forEach(item => {
            const chave = `${item.Braço}-${item.Produto}-${item.Cor}-${item["Quantidade de Moldes"]}`;
            if (!grupos[chave]) {
                grupos[chave] = {
                    braco: item.Braço,
                    produto: item.Produto,
                    cor: item.Cor,
                    qtdMoldes: item["Quantidade de Moldes"],
                    rodadas: {}
                };
            }

            const rodada = item["Número da Rodada"];
            if (!grupos[chave].rodadas[rodada]) {
                grupos[chave].rodadas[rodada] = 0;
            }
            grupos[chave].rodadas[rodada] += item["Quantidade Programada"];
        });

        // Ordenar grupos por Braço, Produto, Cor
        const gruposOrdenados = Object.values(grupos).sort((a, b) => {
            if (a.braco !== b.braco) return a.braco - b.braco;
            if (a.produto !== b.produto) return a.produto.localeCompare(b.produto);
            return a.cor.localeCompare(b.cor);
        });

        // Criar linhas da tabela
        gruposOrdenados.forEach(grupo => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-700 hover:bg-gray-600 transition-colors duration-200';
            tr.dataset.produto = grupo.produto; // Adicionar o produto como atributo de dados

            // Adicionar células fixas
            tr.appendChild(criarCelula(grupo.braco));
            tr.appendChild(criarCelula(grupo.produto));
            tr.appendChild(criarCelula(grupo.cor));
            tr.appendChild(criarCelula(grupo.qtdMoldes));

            // Adicionar células das rodadas (agora até 12)
            for (let i = 1; i <= 12; i++) {
                const quantidade = grupo.rodadas[i] || 0;
                tr.appendChild(criarCelula(quantidade));
            }

            // Adicionar eventos de mouse
            tr.addEventListener('mouseenter', () => {
                const produto = tr.dataset.produto;
                document.querySelectorAll(`#tabela-pivotada tbody tr[data-produto="${produto}"]`).forEach(row => {
                    row.classList.add('highlight-produto');
                });
            });

            tr.addEventListener('mouseleave', () => {
                const produto = tr.dataset.produto;
                document.querySelectorAll(`#tabela-pivotada tbody tr[data-produto="${produto}"]`).forEach(row => {
                    row.classList.remove('highlight-produto');
                });
            });

            tabelaPivotadaBody.appendChild(tr);
        });

        // Mostrar o botão de download
        document.getElementById('download-resumo').classList.remove('hidden');
    }

    function criarCelula(valor) {
        const td = document.createElement('td');
        td.className = 'px-4 py-2 font-medium text-gray-300 whitespace-nowrap';

        // Se o valor for 0, mostrar em branco
        if (valor === 0) {
            td.textContent = '';
        } else {
            td.textContent = valor !== undefined && valor !== null ? valor : '';
        }

        return td;
    }

    // Adicionar evento de filtro
    filtroBraco.addEventListener("change", () => {
        if (dadosProgramacao.length > 0) {
            criarTabelaPivotada(dadosProgramacao);
        }
    });

    function atualizarGraficoProdutos(dados, filtroBraco = null, filtroData = null) {
        criarGraficoProdutos(dados, filtroBraco, filtroData);
    }

    function atualizarGraficoEvolucao(dados, filtroBraco = null, filtroProduto = null) {
        criarGraficoEvolucao(dados, filtroBraco, filtroProduto);
    }

    function atualizarGraficoBracos(dados, filtroProduto = null) {
        criarGraficoBracos(dados, filtroProduto);
    }

    // Função para criar o gráfico de necessidade sem moldes
    function criarGraficoNecessidadeSemMoldes(dados) {
        const ctx = document.getElementById('graficoNecessidadeSemMoldes').getContext('2d');

        // Filtrar itens com quantidade de moldes maior que 0
        const dadosFiltrados = dados.filter(item => item["Qtd. Moldes Cadastrados"] > 0);

        // Agrupar por nome e somar as quantidades
        const agrupados = {};
        dadosFiltrados.forEach(item => {
            const nome = item.Nome;
            if (!agrupados[nome]) {
                agrupados[nome] = 0;
            }
            agrupados[nome] += item["Quantidade"];
        });

        // Ordenar por quantidade do menor para o maior
        const dadosOrdenados = Object.entries(agrupados)
            .sort((a, b) => a[1] - b[1]);

        // Separar nomes e quantidades
        const nomes = dadosOrdenados.map(([nome]) => nome);
        const quantidades = dadosOrdenados.map(([,qtd]) => qtd);

        if (graficoNecessidadeSemMoldes) {
            graficoNecessidadeSemMoldes.destroy();
        }

        graficoNecessidadeSemMoldes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: nomes,
                datasets: [{
                    label: 'Quantidade Faltante',
                    data: quantidades,
                    backgroundColor: 'rgba(34, 197, 94, 0.5)', // green-500
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: 'white'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Necessidade de Produtos Sem Moldes Configurados',
                        color: 'white',
                        font: {
                            size: 16
                        },
                        padding: {
                            bottom: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const nome = context.label;
                                const quantidade = context.raw;
                                // Soma total de todos os itens exibidos no gráfico
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                const perc = total > 0 ? ((quantidade / total) * 100).toFixed(1) : 0;
                                return `Quantidade: ${quantidade} (${perc}%)`;
                            }
                        }
                    },
                    datalabels: {
                        color: 'white',
                        font: {
                            size: 12
                        },
                        formatter: function (value) {
                            return Math.round(value);
                        },
                        anchor: 'end',
                        align: 'end',
                        offset: 4
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'white',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    // Função para exportar a tabela pivotada
    function exportarTabelaPivotada() {
        try {
            const tabela = document.getElementById('tabela-pivotada');
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.table_to_sheet(tabela, { raw: true });

            // Ajustar largura das colunas
            const wscols = [];
            for (let i = 0; i < 16; i++) { // 16 colunas (4 fixas + 12 rodadas)
                wscols.push({ wch: 15 }); // Largura padrão de 15 caracteres
            }
            ws['!cols'] = wscols;

            XLSX.utils.book_append_sheet(wb, ws, "Resumo da Programação");
            XLSX.writeFile(wb, "resumo_programacao.xlsx");
        } catch (error) {
            console.error("Erro ao exportar tabela:", error);
            alert("Erro ao exportar a tabela. Por favor, tente novamente.");
        }
    }

    // Adicionar evento de clique ao botão de download do resumo
    document.getElementById('download-resumo').addEventListener('click', function (e) {
        e.preventDefault();
        exportarTabelaPivotada();
    });

    // Função para atualizar a lista de histórico
    async function atualizarListaHistorico() {
        const historicoLista = document.getElementById('historico-lista');
        historicoLista.innerHTML = '';

        try {
            const response = await fetch("/api/programacao/obter_historico");
            const result = await response.json();

            if (response.ok && result.historico && result.historico.length > 0) {
                result.historico.forEach((item, index) => {
                    const data = new Date(item.timestamp).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    const div = document.createElement('div');
                    div.className = 'flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors duration-200';

                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'flex-1';

                    const dataSpan = document.createElement('span');
                    dataSpan.className = 'text-gray-300 font-medium';
                    dataSpan.textContent = data;

                    const bracoSpan = document.createElement('span');
                    bracoSpan.className = 'text-gray-400 ml-4';
                    bracoSpan.textContent = `Braço: ${item.braco_selecionado || 'Todos'}`;

                    infoDiv.appendChild(dataSpan);
                    infoDiv.appendChild(bracoSpan);

                    const buttonDiv = document.createElement('div');
                    buttonDiv.className = 'flex space-x-2';

                    const carregarBtn = document.createElement('button');
                    carregarBtn.className = 'px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors duration-200';
                    carregarBtn.textContent = 'Carregar';
                    carregarBtn.onclick = () => carregarProgramacaoHistorico(item);

                    buttonDiv.appendChild(carregarBtn);

                    div.appendChild(infoDiv);
                    div.appendChild(buttonDiv);

                    historicoLista.appendChild(div);
                });
            } else {
                const div = document.createElement('div');
                div.className = 'text-gray-400 text-center py-4';
                div.textContent = 'Nenhuma programação encontrada no histórico';
                historicoLista.appendChild(div);
            }
        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
            const div = document.createElement('div');
            div.className = 'text-red-400 text-center py-4';
            div.textContent = 'Erro ao carregar histórico de programações';
            historicoLista.appendChild(div);
        }
    }

    // Função para carregar uma programação do histórico
    function carregarProgramacaoHistorico(dados) {
        mostrarLoading();

        // Atualizar a interface com os dados carregados
        const dataFormatada = new Date(dados.timestamp).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Atualizar a mensagem de atenção
        historicoData.textContent = dataFormatada;
        historicoAlerta.classList.remove('hidden');
        historicoAlerta.classList.add('bg-red-900');
        historicoAlerta.classList.remove('bg-yellow-900');
        historicoAlerta.querySelector('p').innerHTML = `
            <span class="font-bold">Atenção:</span> Os dados que estão sendo exibidos são da programação do dia 
            <span class="font-semibold">${dataFormatada}</span>
        `;

        // Mostrar seção de gráficos e resultados
        graficosSection.classList.remove("hidden");
        resultsSection.classList.remove("hidden");

        // Criar gráficos com os dados do histórico
        if (dados.programacao_data && dados.programacao_data.length > 0) {
            dadosOriginais = dados; // Salva o objeto de dados completo do histórico
            criarGraficoProdutos(dados.programacao_data);
            criarGraficoEvolucao(dados.programacao_data);
            criarGraficoBracos(dados.programacao_data);
            criarGraficoMoldesPorBraco(dados.programacao_data, dados.moldes_ociosos_data);
            criarTabelaPivotada(dados.programacao_data);
        }

        if (dados.moldes_ociosos_data && dados.moldes_ociosos_data.length > 0) {
            criarGraficoMoldesOciosos(dados.moldes_ociosos_data);
            criarGraficoMoldesSemDemanda(dados.moldes_ociosos_data);
            atualizarTempoTotal(dados.moldes_ociosos_data);
        }

        if (dados.necessidade_sem_moldes_data && dados.necessidade_sem_moldes_data.length > 0) {
            criarGraficoNecessidadeSemMoldes(dados.necessidade_sem_moldes_data);
        }

        // Exibir tabelas originais
        displayTableData(programacaoTableBody, dados.programacao_data, ["Número da Rodada", "Data Prevista", "Braço", "Produto", "Cor", "Pedido", "CODPROD", "Quantidade de Moldes", "Quantidade Programada"], noProgramacaoMsg);
        displayTableData(ociososTableBody, dados.moldes_ociosos_data, ["Nome", "Quantidade", "Rodada Ociosa", "Braço"], noOciososMsg);
        displayTableData(necessidadeTableBody, dados.necessidade_sem_moldes_data, ["Nome", "Quantidade", "Qtd. Moldes Cadastrados"], noNecessidadeMsg);

        if (dados.programacao_gerada_url && dados.programacao_data.length > 0) {
            downloadProgramacaoLink.href = dados.programacao_gerada_url;
            downloadProgramacaoLink.classList.remove("hidden");
        }
        if (dados.moldes_ociosos_url && dados.moldes_ociosos_data.length > 0) {
            downloadOciososLink.href = dados.moldes_ociosos_url;
            downloadOciososLink.classList.remove("hidden");
        }
        if (dados.necessidade_sem_moldes_url && dados.necessidade_sem_moldes_data.length > 0) {
            downloadNecessidadeLink.href = dados.necessidade_sem_moldes_url;
            downloadNecessidadeLink.classList.remove("hidden");
        }

        esconderLoading();
    }

});