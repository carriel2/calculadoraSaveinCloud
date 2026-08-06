const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/tess', async(req, res) => {
    const { prompt, context } = req.body;
    const apiKey = process.env.TESS_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ erro: 'Chave da API não configurada no servidor.' });
    }

    try {
        // AQUI VOCÊ TROCA PELA URL REAL DA API DA TESS
        const respostaTess = await fetch('URL_DA_API_DA_TESS', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({ prompt, context })
        });

        const dados = await respostaTess.json();

        res.json({ resposta: dados.resposta_da_tess || "Resposta recebida com sucesso." });

    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Falha ao se comunicar com a Tess.' });
    }
});

app.listen(3000, () => {
    console.log('Backend da Calculadora rodando na porta 3000');
});