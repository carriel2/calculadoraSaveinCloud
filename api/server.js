const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/tess', async(req, res) => {
    const { prompt, context } = req.body;
    const apiKey = process.env.TESS_API_KEY;
    const workspaceId = process.env.TESS_WORKSPACE_ID;
    const agentId = process.env.TESS_AGENT_ID;

    if (!apiKey || !workspaceId || !agentId) {
        return res.status(500).json({ erro: 'Credenciais da Tess ausentes no servidor.' });
    }

    try {
        const tessUrl = `https://api.tess.im/agents/${agentId}/execute`;

        const respostaTess = await fetch(tessUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'x-workspace-id': workspaceId
            },
            body: JSON.stringify({
                mensagem: prompt,
                dados: context,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!respostaTess.ok) {
            const erroDetalhado = await respostaTess.text();
            console.error("Erro da Tess detalhado:", erroDetalhado);
            return res.status(respostaTess.status).json({ erro: `A API da Tess recusou a requisição. Detalhes: ${erroDetalhado}` });
        }

        const dadosRetorno = await respostaTess.json();

        res.json({ resposta: dadosRetorno.reply || dadosRetorno.response || dadosRetorno.message || JSON.stringify(dadosRetorno) });

    } catch (erro) {
        console.error("Erro interno no Node:", erro);
        res.status(500).json({ erro: 'Falha na comunicação com o servidor da Tess.' });
    }
});

app.listen(3000, () => {
    console.log('Backend da Calculadora rodando na porta 3000');
});