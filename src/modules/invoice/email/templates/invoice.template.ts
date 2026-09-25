// src/mail/templates/invoice.template.ts

export const invoiceTemplate = (data: any): string => {
  return `
<!DOCTYPE html>
<html>

<head>
<meta charset="utf-8">

<style>

body{
    margin:0;
    padding:0;
    background:#f3f4f6;
    font-family:Arial,Helvetica,sans-serif;
}

.wrapper{
    width:100%;
    padding:30px 0;
}

.container{
    width:600px;
    margin:auto;
    background:#ffffff;
    border-radius:10px;
    overflow:hidden;
    box-shadow:0 5px 15px rgba(0,0,0,.1);
}

.header{
    background:#2563eb;
    color:white;
    text-align:center;
    padding:30px;
}

.content{
    padding:30px;
}

.info{
    width:100%;
    border-collapse:collapse;
    margin-top:20px;
}

.info td{
    padding:12px;
    border-bottom:1px solid #eee;
}

.footer{
    padding:20px;
    text-align:center;
    color:#777;
    background:#fafafa;
    font-size:13px;
}

.button{
    display:inline-block;
    margin-top:20px;
    background:#2563eb;
    color:#fff !important;
    padding:12px 25px;
    text-decoration:none;
    border-radius:6px;
}

</style>

</head>

<body>

<div class="wrapper">

<div class="container">

<div class="header">
<h2>Invoice Generated</h2>
</div>

<div class="content">

<p>Hello <strong>${data.customer.name}</strong>,</p>

<p>
Your invoice has been generated successfully.
Please find the attached invoice PDF.
</p>

<table class="info">

<tr>
<td><strong>Invoice No</strong></td>
<td>${data.refNo}</td>
</tr>

<tr>
<td><strong>Date</strong></td>
<td>${data.fromDate}</td>
</tr>

<tr>
<td><strong>Total</strong></td>
<td>₹${data.amount}</td>
</tr>

<tr>
<td><strong>Status</strong></td>
<td style="color:green;">Paid</td>
</tr>

</table>

<a href="https://yourdomain.com" class="button">
View Website
</a>

</div>

<div class="footer">

© ${new Date().getFullYear()} Your Company

</div>

</div>

</div>

</body>

</html>
`;
};
