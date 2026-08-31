export function emailLayout({
  title,
  content,
  buttonText,
  buttonUrl,
}) {
  return `
    <!DOCTYPE html>
    <html>
      <body style="
        margin:0;
        padding:40px 20px;
        background:#0F0F1A;
        font-family:Inter, Arial, sans-serif;
      ">
        <div style="
          max-width:600px;
          margin:0 auto;
          background:#1A1A2E;
          border-radius:12px;
          padding:40px;
        ">

          <h1 style="color:#6C63FF;">
            Repress
          </h1>

          <h2 style="color:white;">
            ${title}
          </h2>

          ${content}

          <div style="margin:40px 0;">
            <a
              href="${buttonUrl}"
              style="
                background:#6C63FF;
                color:white;
                padding:14px 28px;
                text-decoration:none;
                border-radius:8px;
                display:inline-block;
              "
            >
              ${buttonText}
            </a>
          </div>

          <hr style="border-color:#333;" />

          <p style="color:#9999AA;">
            Built by iVector Academy
          </p>

        </div>
      </body>
    </html>
  `;
}