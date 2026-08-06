const express = require('express');
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.post('/api/tess', async(req, res) => {
    const { prompt, context, image } = req.body;
    console.log("DADOS RECEBIDOS:", { prompt, possuiImagem: !!image });

    const apiKey = process.env.TESS_API_KEY;
    const workspaceId = process.env.TESS_WORKSPACE_ID;
    const agentId = process.env.TESS_AGENT_ID;

    if (!apiKey || !workspaceId || !agentId) {
        console.error("Credenciais ausentes no servidor.");
        return res.status(500).json({ erro: 'Credenciais ausentes.' });
    }

    try {
        const tessUrl = `https://api.tess.im/agents/${agentId}/execute`;

        const textoUsuario = prompt || "Analise esta arquitetura/imagem e os dados atuais.";
        const jsonCalculadora = context || "{}";
        let conteudoMensagem = textoUsuario;

        if (image) {
            conteudoMensagem = [
                { type: 'text', text: textoUsuario },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } }
            ];
        }

        const payload = {
            mensagem: textoUsuario,
            dados: jsonCalculadora,
            messages: [{ role: 'user', content: conteudoMensagem }]
        };

        const respostaTess = await fetch(tessUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'x-workspace-id': workspaceId
            },
            body: JSON.stringify(payload)
        });

        if (!respostaTess.ok) {
            const erroDetalhado = await respostaTess.text();
            console.error("ERRO DA TESS:", erroDetalhado);
            return res.status(respostaTess.status).json({ erro: `Erro da Tess: ${erroDetalhado}` });
        }

        const dadosIniciais = await respostaTess.json();
        const execucaoId = dadosIniciais.responses && dadosIniciais.responses[0] ? dadosIniciais.responses[0].id : null;

        if (!execucaoId) {
            return res.json({ resposta: "Tess não retornou um ID de execução." });
        }

        console.log(`Processando... (ID: ${execucaoId})... Aguardando...`);

        let respostaFinal = "";
        let tentativas = 0;

        while (tentativas < 15) {
            await new Promise(r => setTimeout(r, 2000));

            const pollRes = await fetch(`https://api.tess.im/agent-responses/${execucaoId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'x-workspace-id': workspaceId
                }
            });

            const pollData = await pollRes.json();
            const status = pollData.status;

            console.log(`Tentativa ${tentativas + 1}: Status = ${status}`);

            if (status === 'completed' || status === 'done' || pollData.output) {
                respostaFinal = pollData.output;
                break;
            } else if (status === 'failed' || status === 'error') {
                respostaFinal = "Ops, a Tess encontrou um erro no meio do caminho.";
                break;
            }

            tentativas++;
        }

        console.log("SUCESSO.");

        res.json({ resposta: respostaFinal.replace(/\n/g, '<br>') || "A Tess demorou muito para responder." });

    } catch (erro) {
        console.error("ERRO INTERNO NO NODE:", erro);
        res.status(500).json({ erro: 'Falha na comunicação com o servidor da Tess.' });
    }
});

app.listen(3000, () => {
    console.log('Backend rodando e suportando imagens pesadas!');
});