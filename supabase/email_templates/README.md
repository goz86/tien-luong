# Supabase Auth email templates

## Confirm signup

Use `confirm_signup.html` for:

`Supabase Dashboard -> Authentication -> Email Templates -> Confirm signup`

Suggested subject:

```text
Xác nhận email để bắt đầu với Duhoc Mate
```

Keep this variable unchanged inside the HTML:

```text
{{ .ConfirmationURL }}
```

Supabase replaces it with the real confirmation link when sending the email.

## Sender name

Changing the template subject/body is done in `Email Templates`.

Changing the sender shown as `Supabase Auth` to `Duhoc Mate` requires Custom SMTP in:

`Supabase Dashboard -> Authentication -> SMTP Settings`

Recommended values:

```text
Sender name: Duhoc Mate
Sender email: no-reply@your-domain.com
```

After enabling Custom SMTP, Supabase sends Auth emails with your configured sender name. For production, also configure SPF, DKIM, and DMARC on the sending domain.
