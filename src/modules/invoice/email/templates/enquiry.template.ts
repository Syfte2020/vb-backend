export const enquiryTemplate = (data: {
  customerName: string;
  venueName: string;
  enquiryId: string;
  enquiryDate: string;
  eventDate?: string;
  eventType?: string;
  guests?: number;
  message?: string;
}) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Enquiry Received</title>

<style>

body{
    margin:0;
    padding:0;
    background:#f5f5f5;
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
    border-radius:8px;
    overflow:hidden;
    box-shadow:0 2px 10px rgba(0,0,0,.08);
}

.header{
    background:#0f4c81;
    color:#ffffff;
    text-align:center;
    padding:25px;
}

.content{
    padding:30px;
    color:#333333;
    line-height:1.7;
}

.info-table{
    width:100%;
    border-collapse:collapse;
    margin:25px 0;
}

.info-table td{
    padding:12px;
    border-bottom:1px solid #eeeeee;
}

.label{
    font-weight:bold;
    width:180px;
}

.message-box{
    background:#f8f9fa;
    border-left:4px solid #0f4c81;
    padding:15px;
    margin-top:20px;
}

.footer{
    background:#fafafa;
    text-align:center;
    color:#777777;
    padding:20px;
    font-size:13px;
}

.button{
    display:inline-block;
    padding:12px 25px;
    margin-top:20px;
    background:#0f4c81;
    color:#ffffff !important;
    text-decoration:none;
    border-radius:5px;
}

</style>

</head>

<body>

<div class="wrapper">

<div class="container">

<div class="header">
<h2>Enquiry Received</h2>
</div>

<div class="content">

<p>Dear <strong>${data.customerName}</strong>,</p>

<p>
Thank you for your enquiry. We have successfully received your request
and our team will review it shortly.
</p>

<table class="info-table">

<tr>
<td class="label">Enquiry ID</td>
<td>${data.enquiryId}</td>
</tr>

<tr>
<td class="label">Venue</td>
<td>${data.venueName}</td>
</tr>

<tr>
<td class="label">Enquiry Date</td>
<td>${data.enquiryDate}</td>
</tr>

${
  data.eventDate
    ? `
<tr>
<td class="label">Event Date</td>
<td>${data.eventDate}</td>
</tr>
`
    : ""
}

${
  data.eventType
    ? `
<tr>
<td class="label">Event Type</td>
<td>${data.eventType}</td>
</tr>
`
    : ""
}

${
  data.guests
    ? `
<tr>
<td class="label">Expected Guests</td>
<td>${data.guests}</td>
</tr>
`
    : ""
}

</table>

${
  data.message
    ? `
<div class="message-box">
<strong>Your Message</strong><br><br>
${data.message}
</div>
`
    : ""
}

<p>
Our team will contact you as soon as possible with availability,
pricing, and further details.
</p>

<p style="text-align:center;">
<a href="https://yourdomain.com" class="button">
View Enquiry
</a>
</p>

</div>

<div class="footer">
<p>
This is an automated email. Please do not reply directly.
</p>

<p>
© ${new Date().getFullYear()} Your Company. All Rights Reserved.
</p>
</div>

</div>

</div>

</body>
</html>
`;
};