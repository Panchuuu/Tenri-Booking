<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    | Canal server-to-server con el panel de administración de tenri.cl.
    | La clave es la misma que el panel tiene en su BOOKING_PANEL_KEY; la lee
    | el middleware VerificarFirmaPanel (entrante). Sin ella, el canal entero
    | responde 401 (falla cerrado).
    | Generar con: php artisan tinker --execute="echo bin2hex(random_bytes(32));"
    */
    'panel' => [
        'integration_key' => env('PANEL_INTEGRATION_KEY'),
    ],

];
