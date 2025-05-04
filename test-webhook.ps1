# Configuración
$webhookUrl = "http://localhost:4040/webhook/telegram"
$botToken = "7613642696:AAEH90iXJZeSt2CZxFueL_IYYD_D6XOTl6s"
$message = "Hola bot!"

# Primero, obtener las actualizaciones para encontrar el chat_id real
try {
    $updatesUrl = "https://api.telegram.org/bot$botToken/getUpdates"
    $updates = Invoke-RestMethod -Uri $updatesUrl -Method Get
    Write-Host "📱 Actualizaciones de Telegram:"
    Write-Host ($updates | ConvertTo-Json -Depth 10)
    
    if ($updates.ok -and $updates.result.Count -gt 0) {
        $chatId = $updates.result[0].message.chat.id
        Write-Host "✅ Chat ID encontrado: $chatId"
    } else {
        Write-Host "⚠️ No se encontraron mensajes recientes. Envía un mensaje a tu bot primero."
        exit
    }
} catch {
    Write-Host "❌ Error al obtener actualizaciones:"
    Write-Host $_.Exception.Message
    exit
}

# Crear el cuerpo de la solicitud
$body = @{
    message = @{
        message_id = 1
        from = @{
            id = 123456789
            is_bot = $false
            first_name = "Test"
            username = "testuser"
        }
        chat = @{
            id = $chatId
            first_name = "Test"
            username = "testuser"
            type = "private"
        }
        date = [int](Get-Date -UFormat %s)
        text = $message
    }
} | ConvertTo-Json -Depth 10

# Enviar la solicitud
try {
    $response = Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $body -ContentType "application/json"
    Write-Host "✅ Solicitud enviada correctamente"
    Write-Host "Respuesta: $response"
} catch {
    Write-Host "❌ Error al enviar la solicitud:"
    Write-Host $_.Exception.Message
} 