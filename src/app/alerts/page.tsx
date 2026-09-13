import { redirect } from 'next/navigation'

// O módulo Alertas virou a faixa "Sinais" dentro de Notícias, onde os números
// ficam ao lado do Panorama que os produziu. A página antiga nunca carregou
// nada sozinha: seu único botão chamava /api/alerts/check, que o middleware
// bloqueia com 401 porque o navegador não pode mandar o header do CRON_SECRET.
//
// Redirect em vez de remover a rota: um 404 num link interno já salvo custa
// mais que estas três linhas. O cron diário (.github/workflows/alerts.yml)
// continua intacto — é o único que varre TODOS os clientes e manda e-mail.
export default function AlertsPage() {
  redirect('/news')
}
