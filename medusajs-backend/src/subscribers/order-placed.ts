import { 
  type SubscriberConfig, 
  type SubscriberArgs,
} from "@medusajs/medusa"
import { Resend } from 'resend';

// Inicializamos Resend con la clave que pusiste en .env
// Nota: Asegúrate de que process.env.RESEND_API_KEY carga bien, 
// o usa el plugin service si prefieres la arquitectura oficial.
// Para hacerlo RÁPIDO y fácil ahora mismo, lo llamamos directo:

export default async function handleOrderPlaced({ 
  data, 
  eventName, 
  container, 
  pluginOptions, 
}: SubscriberArgs<Record<string, any>>) {
  
  // 1. Recuperamos los datos del pedido
  const orderService = container.resolve("orderService")
  const order = await orderService.retrieve(data.id, {
    relations: ["items", "shipping_address"],
  })

  // 2. Preparamos el cliente de Resend
  const resend = new Resend(process.env.RESEND_API_KEY);

  // 3. Diseñamos el HTML (Básico estilo Nebula)
  const itemsHtml = order.items.map(item => 
    `<li style="margin-bottom: 10px;">
       <strong>${item.title}</strong> x ${item.quantity}<br>
       <span style="color: #888;">${(item.unit_price / 100).toFixed(2)} €</span>
     </li>`
  ).join("");

  // 4. Enviamos el email
  // 4. Enviamos el email
  try {
    // 👇 AQUÍ ESTÁ EL CAMBIO: Añadimos 'as any' al final de la llamada
    const response = await resend.emails.send({
      from: 'Nebula Store <onboarding@resend.dev>',
      to: [order.email],
      subject: `Confirmación de pedido #${order.display_id}`,
      html: `
        <div style="background-color: #0f172a; color: white; padding: 40px; font-family: sans-serif;">
          <h1 style="color: #22d3ee;">Misión Confirmada 🚀</h1>
          <p>Hola, gracias por tu pedido en Nebula.</p>
          <p>Tu identificador de misión es: <strong>#${order.display_id}</strong></p>
          
          <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Resumen de carga:</h3>
            <ul style="list-style: none; padding: 0;">
              ${itemsHtml}
            </ul>
            <hr style="border-color: #334155;">
            <p style="font-size: 18px; font-weight: bold; text-align: right;">
              Total: ${(order.total / 100).toFixed(2)} €
            </p>
          </div>

          <p style="font-size: 12px; color: #94a3b8;">
            Enviaremos otro comunicado cuando la nave haya despegado (pedido enviado).
          </p>
        </div>
      `,
    }) as any; // <--- ¡ESTO ES LA CLAVE! 🔑

    // Ahora extraemos los datos manualmente del objeto 'any'
    const emailData = response.data;
    const error = response.error;

    if (error) {
      console.error("Error enviando email:", error);
    } else {
      console.log("Email enviado con éxito:", emailData);
    }

  } catch (err) {
    console.error("Fallo crítico enviando email:", err);
  }

export const config: SubscriberConfig = {
  event: "order.placed",
  context: {
    subscriberId: "order-placed-handler",
  },
}