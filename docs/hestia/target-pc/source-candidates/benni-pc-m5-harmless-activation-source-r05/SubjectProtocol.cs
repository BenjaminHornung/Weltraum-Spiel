using System;using System.Collections.Generic;using System.Globalization;using System.Text.Json;
namespace Hestia.M5.Native24Source {public static partial class Native24Family {
 private static class SubjectProtocol {
  public const string Register="M5_SUBJECT_REGISTER_V1",Ack="M5_SUBJECT_ACK_V1",Retire="M5_SUBJECT_RETIRE_V1",Closed="M5_SUBJECT_CLOSED_V1";
  public const string RequestFields="schema version mode grantId packageHash contextHash consumedHash suiteToken registrationNonce probeNonce pid creation parentPid image creatorPid creatorCreation creatorImage handleOwnerPid handleOwnerCreation handleOwnerImage sourceHandle role scenario ordinal requestPath requestSha256 controllerPid controllerCreation hostPid hostCreation nativeOrigin issued workEnd overallEnd utcIssued utcEnd",AckFields="schema version mode grantId packageHash contextHash consumedHash suiteToken registrationNonce probeNonce pid creation parentPid image creatorPid creatorCreation creatorImage handleOwnerPid handleOwnerCreation handleOwnerImage sourceHandle role scenario ordinal requestPath requestSha256 controllerPid controllerCreation hostPid hostCreation nativeOrigin issued workEnd overallEnd utcIssued utcEnd recordId recordSha256 observedNative observedUtc registryCount response";
  public static Dictionary<string,string> Parse(string line,out string header){
   Require(line!=null&&line.Length<=65536,"SUBJECT_PACKET_BOUND");int i=line.IndexOf('\t');Require(i>0,"SUBJECT_HEADER");
   header=line.Substring(0,i);string schema;
   if(header==Register)schema="hestia.m5.subject.register.v1";else if(header==Ack)schema="hestia.m5.subject.ack.v1";else if(header==Retire)schema="hestia.m5.subject.retire.v1";else if(header==Closed)schema="hestia.m5.subject.closed.v1";else throw new InvalidOperationException("SUBJECT_UNKNOWN_HEADER");
   var d=FlatJson(line.Substring(i+1));var keys=(header==Ack||header==Closed?AckFields:RequestFields).Split(' ');
   Require(d.Count==keys.Length,"SUBJECT_CLOSED_FIELDS");foreach(var k in keys)RequiredRootField(d,k);
   Require(Field(d,"schema")==schema&&Field(d,"version")=="1","SUBJECT_VERSION");
   string mode=Field(d,"mode");Require(header==Retire||header==Closed?mode=="RETIRE":mode=="REGISTER"||mode=="PRECHECK"||mode=="PROBE","SUBJECT_MODE");
   foreach(var k in new[]{"registrationNonce","probeNonce","grantId"})Require(Guid.ParseExact(Field(d,k),"D").ToString("D")==Field(d,k),"SUBJECT_NONCE");
   foreach(var k in new[]{"pid","creation","parentPid","creatorPid","creatorCreation","handleOwnerPid","handleOwnerCreation","sourceHandle","controllerPid","controllerCreation","hostPid","hostCreation","issued","workEnd","overallEnd","utcIssued","utcEnd"})Canonical(Field(d,k));
   Canonical(Field(d,"ordinal"));
   if(header==Ack||header==Closed){foreach(var k in new[]{"observedNative","observedUtc","registryCount"})Canonical(Field(d,k));Require(Field(d,"response")==(header==Closed?"RETIRED":mode=="REGISTER"?"REGISTERED":mode=="PRECHECK"?"PRECHECKED":"PROBED"),"SUBJECT_ACK_EXACT_MODE");}
   return d;
  }
  public static string Encode(string header,Dictionary<string,string>d){string line=header+"\t"+JsonSerializer.Serialize(d);string check;Parse(line,out check);return line;}
  public static Dictionary<string,string> Request(string header,Dictionary<string,string>frame,string role,string scenario,string ordinal,string request,string hash){
   var d=new Dictionary<string,string>(StringComparer.Ordinal);foreach(var k in RequestFields.Split(' '))d[k]="0";
   d["schema"]=header==Retire?"hestia.m5.subject.retire.v1":"hestia.m5.subject.register.v1";d["version"]="1";d["mode"]=header==Retire?"RETIRE":"REGISTER";
   foreach(var k in new[]{"grantId","suiteToken","controllerPid","controllerCreation","hostPid","hostCreation","nativeOrigin","issued","workEnd","overallEnd","utcIssued","utcEnd"})d[k]=Field(frame,k);
   d["packageHash"]=Field(frame,"packageRecordSha256");d["contextHash"]=Field(frame,"contextRecordSha256");d["consumedHash"]=Field(frame,"consumedSha256");
   d["registrationNonce"]=Guid.NewGuid().ToString("D");d["probeNonce"]=Guid.NewGuid().ToString("D");d["role"]=role;d["scenario"]=scenario;d["ordinal"]=ordinal;d["requestPath"]=request;d["requestSha256"]=hash;d["image"]="NONE";d["creatorImage"]="NONE";d["handleOwnerImage"]="NONE";return d;
  }
  public static void Holder(Dictionary<string,string>d){
   IntPtr p=GetCurrentProcess();d["handleOwnerPid"]=ProcessId(p).ToString(CultureInfo.InvariantCulture);d["handleOwnerCreation"]=CreationTime(p).ToString(CultureInfo.InvariantCulture);d["handleOwnerImage"]=ImagePath(p);
  }
 }
}}
