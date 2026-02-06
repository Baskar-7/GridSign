using GridSign.Configurations;
using GridSign.Helpers;

namespace GridSign.Services.Util;

using System.Net;  
using System.Net.Mail;  

class SendMail 
{
    private const string SmtpAddress = "smtp.gmail.com";
    private const int PortNumber = 587;
    private const bool EnableSsl = true;
    private const string EmailFromAddress = "gridsignatures@gmail.com"; 
    
    public async static Task<(string status,string message)> Send(string emailToAddress, string subject, string body)
    {
        var status = "error";
        var message = "An Exception occured! While sending email..";
        try
        {
            using var mail = new MailMessage();
            mail.From = new MailAddress(EmailFromAddress);  
            mail.To.Add(emailToAddress);  
            mail.Subject = subject;  
            mail.Body = body;  
            mail.IsBodyHtml = true;  
            //mail.Attachments.Add(new Attachment("D:\\TestFile.txt")); 
            using var smtp = new SmtpClient(SmtpAddress, PortNumber);
            smtp.Credentials = new NetworkCredential(EmailFromAddress, Configs.MailCredential);  
            smtp.EnableSsl = EnableSsl;  
            await smtp.SendMailAsync(mail);
            status = "success";
            message = "Email sent successfully!";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status,message);
    }  
}   