export function emailVerifyTemplate(name: string, otp: string) {
  return ` 
  <div style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;">

    <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:#4f46e5;padding:20px;text-align:center;color:#fff;">
        <h2 style="margin:0;">Reset Your Password</h2>
      </div>

      <!-- Body -->
      <div style="padding:30px;text-align:center;color:#333;">

        <h3 style="margin-bottom:10px;">Hello ${name || "User"},</h3>

        <p style="font-size:15px;color:#666;">
          We received a request to reset your password.
        </p>

        <p style="font-size:15px;color:#666;">
          Use the OTP below to reset your password:
        </p>

        <!-- OTP BOX -->
        <div style="
          margin:30px 0;
          font-size:32px;
          font-weight:bold;
          letter-spacing:6px;
          color:#4f46e5;
        ">
          ${otp}
        </div>

        <p style="font-size:13px;color:#888;">
          This OTP will expire in <b>5 minutes</b>.
        </p>

        <p style="font-size:13px;color:#888;margin-top:10px;">
          Do not share this code with anyone.
        </p>

        <p style="font-size:12px;color:#aaa;margin-top:20px;">
          If you didn’t request this, you can safely ignore this email.
        </p>

      </div>

      <!-- Footer -->
      <div style="background:#f1f1f1;padding:15px;text-align:center;font-size:12px;color:#777;">
        © ${new Date().getFullYear()} Your Platform Name. All rights reserved.
      </div>

    </div>
  </div>
  `;
}
