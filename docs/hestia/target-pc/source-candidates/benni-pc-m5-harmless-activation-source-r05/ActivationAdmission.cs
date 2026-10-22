using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;

namespace Hestia.M5.Native24Source
{
 public static partial class Native24Family
 {
  private enum ActivationRole{Controller,Observer,Supervisor}
  // Root's independent reviewed runtime handoff/verification seam. No issuer/service is created here.
  // No public setter, caller JSON, environment switch or pure-model result can populate this slot.
  private static readonly IExternalRootRuntimeVerifier externalRootRuntimeVerifier=new RootRuntimeVerifier();
  private static VerifiedRootRuntimeProof activationProof;
  private interface IExternalRootRuntimeVerifier{
   VerifiedRootRuntimeProof VerifyCurrentFixedEntry(ActivationRole role,string fixedRequestPath);
   void VerifyCurrentPhase(VerifiedRootRuntimeProof proof,string phase);
   void ConsumeControllerOnce(VerifiedRootRuntimeProof proof);
   string VerifiedNodeOrigin(VerifiedRootRuntimeProof proof,QualificationScenario scenario);
  }
  // Only a trusted Root verifier can return this private in-process proof; not a serialized receipt.
  private sealed class VerifiedRootRuntimeProof{
   public readonly IReadOnlyDictionary<string,string> ExpectedRoot;
   public readonly IReadOnlyDictionary<string,string> Observed;
   public readonly bool IdentityAndLeaseVerified,NativeClockDomainVerified,ScopeVerified;
   public VerifiedRootRuntimeProof(IReadOnlyDictionary<string,string> expected,IReadOnlyDictionary<string,string> observed,bool identity,bool clock,bool scope){
    ExpectedRoot=new System.Collections.ObjectModel.ReadOnlyDictionary<string,string>(new Dictionary<string,string>(expected));Observed=new System.Collections.ObjectModel.ReadOnlyDictionary<string,string>(new Dictionary<string,string>(observed));IdentityAndLeaseVerified=identity;NativeClockDomainVerified=clock;ScopeVerified=scope;
   }
  }
  private static string RequiredRootField(IReadOnlyDictionary<string,string> fields,string key){
   string value;Require(fields!=null&&fields.TryGetValue(key,out value)&&!String.IsNullOrWhiteSpace(value),"HOLD_ROOT_BINDING_MISSING:"+key);
   return fields[key];
  }
  private static bool HashShape(string value){
   if(value==null||value.Length!=64)return false;
   foreach(char c in value)if(!(c>='0'&&c<='9'||c>='a'&&c<='f'))return false;
   return true;
  }
  private static string ExpectedPackagePinsSha256(VerifiedRootRuntimeProof proof){
   string value=RequiredRootField(proof.ExpectedRoot,"packagePinsSha256");Require(HashShape(value),"HOLD_ROOT_EXPECTED_PACKAGE_UNISSUED");return value;
  }
  private static VerifiedRootRuntimeProof AdmitFixedEntry(ActivationRole role,string requestPath){
   IExternalRootRuntimeVerifier verifier=externalRootRuntimeVerifier;
   Require(verifier!=null,"ROOT_RUNTIME_VERIFIER_UNISSUED");
   VerifiedRootRuntimeProof proof=verifier.VerifyCurrentFixedEntry(role,requestPath);
   Require(proof!=null&&proof.IdentityAndLeaseVerified&&proof.NativeClockDomainVerified&&proof.ScopeVerified,"HOLD_INDEPENDENT_ROOT_PROOF_REQUIRED");
   var expected=proof.ExpectedRoot;var observed=proof.Observed;
   Require(RequiredRootField(expected,"issuer")=="ROOT_INDEPENDENT_RUNTIME_HANDOFF","HOLD_ROOT_ISSUER");
   Require(RequiredRootField(expected,"ownerNative")=="01a13648-c55b-7250-bf07-34921d70b43b","HOLD_FOREIGN_OWNER");
   Require(RequiredRootField(expected,"scope")=="HARMLESS_SIX_ONCE","HOLD_WRONG_POPULATION_OR_SCOPE");
   Require(RequiredRootField(expected,"mode")=="REAL_RUNTIME"&&RequiredRootField(expected,"authorityState")==(role==ActivationRole.Controller?"HOST_CONSUMED_SAME_CONTROLLER":"ACTIVE_OWN_CONTROLLER"),"HOLD_UNISSUED_OR_CONSUMED_AUTHORITY");
   Require(RequiredRootField(expected,"nativeClockApi")=="GetTickCount64"&&RequiredRootField(expected,"utcClockApi")=="DateTimeOffset.UtcNow","HOLD_UNPROVEN_CLOCK_API");
   Require(RequiredRootField(expected,"capacity")=="ONE_CONTROLLER_SIX_SERIAL_LANES_ACTIVE3"&&RequiredRootField(expected,"outputExclusive")=="true","HOLD_CAPACITY_OR_CUSTODY");
   foreach(string key in new[]{"ownerNative","ownerProcessId","ownerCreation","ownerImage","runnerId","runnerProcessId","runnerCreation","paseoAgent","workspace","leaseId","leaseExpiresUtc","capacity","outputExclusive","outputCustodyId","suiteToken","nativeOrigin","nativeClockDomain","nativeClockApi","utcClockApi","issued","workEnd","overallEnd","utcIssued","utcEnd","sourceRoot","suiteOutputRoot","packagePinsSha256","nodeSha256","powerShellSha256","dllSha256","fixtureSha256","subjectPid","subjectCreation","subjectParentPid","subjectImage","role","requestPath"}){
    Require(RequiredRootField(expected,key)==RequiredRootField(observed,key),"HOLD_ROOT_OBSERVATION_MISMATCH:"+key);
   }
   IntPtr self=GetCurrentProcess();
   Require(ProcessId(self).ToString(CultureInfo.InvariantCulture)==RequiredRootField(expected,"subjectPid")&&CreationTime(self).ToString(CultureInfo.InvariantCulture)==RequiredRootField(expected,"subjectCreation")&&ParentProcessId(self).ToString(CultureInfo.InvariantCulture)==RequiredRootField(expected,"subjectParentPid")&&String.Equals(ImagePath(self),Full(RequiredRootField(expected,"subjectImage")),StringComparison.OrdinalIgnoreCase),"HOLD_ACTUAL_SUBJECT_TUPLE");
   Require(RequiredRootField(expected,"sourceRoot")==SourceRoot,"HOLD_FIXED_SOURCE_ROOT");
   Require(RequiredRootField(expected,"role")==role.ToString(),"HOLD_FIXED_NATIVE_ROLE");
   string token=RequiredRootField(expected,"suiteToken");Guid.ParseExact(token,"D");Guid.ParseExact(RequiredRootField(expected,"nativeOrigin"),"D");
   string suiteRoot=Path.Combine(QualificationRunsRoot,token);
   Require(Full(RequiredRootField(expected,"suiteOutputRoot"))==Full(suiteRoot),"HOLD_FIXED_OUTPUT");
   string expectedRequest=RequiredRootField(expected,"requestPath");
   if(role==ActivationRole.Controller){Require(requestPath==null&&expectedRequest=="NONE","HOLD_CONTROLLER_REQUEST");}
   else{
    Require(requestPath!=null&&Full(requestPath)==Full(expectedRequest),"HOLD_FIXED_ROLE_REQUEST");
    string name=role==ActivationRole.Observer?"observer.control.tsv":"supervisor.control.tsv";
    string directory=Path.GetDirectoryName(Full(requestPath));Require(Path.GetFileName(requestPath)==name,"HOLD_FIXED_ROLE_FILE");
    Require(directory!=null&&directory.StartsWith(Full(suiteRoot)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase),"HOLD_ROLE_OUTPUT");
    Require(Full(directory)==Full(QualificationOutputRoot(token,Scenario(Path.GetFileName(directory)))),"HOLD_FIXED_SCENARIO_REQUEST");
    string requestHash=RequiredRootField(expected,"requestSha256");Require(HashShape(requestHash)&&requestHash==RequiredRootField(observed,"requestSha256")&&HashFile(requestPath)==requestHash,"HOLD_ROOT_EXPECTED_REQUEST_BYTES");
   }
   long issued=Canonical(RequiredRootField(expected,"issued")),work=Canonical(RequiredRootField(expected,"workEnd")),end=Canonical(RequiredRootField(expected,"overallEnd"));
   long utcIssued=Canonical(RequiredRootField(expected,"utcIssued")),utcEnd=Canonical(RequiredRootField(expected,"utcEnd"));
   Require(work-issued==48000&&end-issued==60000&&end-work==12000&&utcEnd-utcIssued==60000,"HOLD_ORIGINAL_60_48_12_ENDS");
   verifier.VerifyCurrentPhase(proof,"native-pre-effects");
   // Domain comparability is an independently verified premise, never inferred from matching labels.
   Require(GetTickCount64()>=(ulong)issued&&GetTickCount64()<=(ulong)end&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()>=utcIssued&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=utcEnd,"HOLD_ENTRY_DEADLINE");
   Require(Canonical(RequiredRootField(expected,"leaseExpiresUtc"))>=utcEnd,"HOLD_LEASE_WINDOW");
   Require(HashFile(Path.Combine(SourceRoot,"QUAL_SOURCE_PINS.tsv"))==ExpectedPackagePinsSha256(proof),"HOLD_EXPECTED_ROOT_PACKAGE_BYTES");
   foreach(var pair in new[]{new[]{"nodeSha256",NodePath},new[]{"powerShellSha256",PowerShellPath},new[]{"dllSha256",Path.Combine(SourceRoot,"HarmlessActivation.dll")},new[]{"fixtureSha256",Path.Combine(SourceRoot,"harmless-fixture.mjs")}}){
    string hash=RequiredRootField(expected,pair[0]);Require(HashShape(hash)&&HashFile(pair[1])==hash,"HOLD_ROOT_TOOL_DLL_FIXTURE_BYTES:"+pair[0]);
   }
   verifier.VerifyCurrentPhase(proof,"native-after-bytes");
   Require(GetTickCount64()>=(ulong)issued&&GetTickCount64()<=(ulong)end&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()>=utcIssued&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=utcEnd,"HOLD_AFTER_BYTES_BEFORE_CONSUME_DEADLINE");
   if(role==ActivationRole.Controller)verifier.ConsumeControllerOnce(proof);
   return proof;
  }
  private static void AssertAdmittedRun(BoundRun run){
   Require(activationProof!=null&&externalRootRuntimeVerifier!=null,"HOLD_NO_PRODUCTION_PROOF");
   var root=activationProof.ExpectedRoot;
   Require(run.BatchToken==RequiredRootField(root,"suiteToken")&&run.NativeOrigin==RequiredRootField(root,"nativeOrigin")&&run.PinsSha256==ExpectedPackagePinsSha256(activationProof),"HOLD_REQUEST_ROOT_BINDING");
   Require(run.NodeOrigin==externalRootRuntimeVerifier.VerifiedNodeOrigin(activationProof,run.Scenario),"HOLD_VERIFIED_NODE_ORIGIN");
   Require(run.Issued==(ulong)Canonical(RequiredRootField(root,"issued"))&&run.WorkDeadline==(ulong)Canonical(RequiredRootField(root,"workEnd"))&&run.OverallEnd==(ulong)Canonical(RequiredRootField(root,"overallEnd"))&&run.IssuedUtcMs==Canonical(RequiredRootField(root,"utcIssued"))&&run.OverallUtcMs==Canonical(RequiredRootField(root,"utcEnd")),"HOLD_REQUEST_END_DRIFT");
   externalRootRuntimeVerifier.VerifyCurrentPhase(activationProof,"bound-run");
  }
 }
}
