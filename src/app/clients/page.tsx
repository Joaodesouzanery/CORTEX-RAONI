import { redirect } from 'next/navigation'

// Clientes passou para dentro de Fontes; links antigos continuam funcionando.
export default function Page() {
  redirect('/sources?tab=clientes')
}
