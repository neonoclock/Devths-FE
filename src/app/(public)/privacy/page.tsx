'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export default function PrivacyPage() {
  const router = useRouter();

  const handleBackClick = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  }, [router]);

  return (
    <main className="min-h-dvh bg-transparent">
      <div className="mx-auto w-full bg-white px-6 py-8 sm:max-w-[430px] sm:shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
        <article className="mx-auto w-full max-w-2xl space-y-6 text-sm leading-6 text-neutral-800">
          <div>
            <button
              type="button"
              onClick={handleBackClick}
              className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              <span aria-hidden="true">&larr;</span>
              뒤로가기
            </button>
          </div>
          <header className="space-y-2">
            <h1 className="text-xl font-bold text-neutral-900">Devths 개인정보 처리방침</h1>
            <p>
              <strong>KTB_Devths</strong> (이하 &quot;회사&quot;)는 사용자의 개인정보를 중요시하며,
              &quot;개인정보 보호법&quot; 등 관련 법령을 준수하고 있습니다. 회사는 본 방침을 통해
              사용자가 제공하는 개인정보가 어떤 용도와 방식으로 이용되고 있는지 알려드립니다.
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              1. 수집하는 개인정보의 항목 및 수집 방법
            </h2>
            <p>
              회사는 회원가입, 서비스 이용, AI 채팅 서비스 제공을 위해 아래와 같은 개인정보를
              수집하고 있습니다.
            </p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>구글 로그인(OAuth)을 통해 수집하는 항목</strong>
                <ul className="list-disc pl-5">
                  <li>필수: 이메일 주소, 이름(닉네임), 프로필 사진 URL</li>
                  <li>목적: 회원 식별, 계정 생성 및 로그인 유지</li>
                </ul>
              </li>
              <li>
                <strong>서비스 이용 과정에서 수집되는 항목</strong>
                <ul className="list-disc pl-5">
                  <li>사용자가 입력하는 대화 내용(AI 채팅 로그)</li>
                  <li>사용자가 업로드하는 문서 내 정보(이력서, 포트폴리오 등)</li>
                  <li>서비스 이용 기록, 접속 로그, IP 주소</li>
                </ul>
              </li>
              <li>
                <strong>수집 방법</strong>
                <ul className="list-disc pl-5">
                  <li>홈페이지 회원가입, 서비스 이용, 생성형 AI와의 대화</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              2. 개인정보의 수집 및 이용 목적
            </h2>
            <p>회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>회원 관리:</strong> 본인 확인, 개인 식별, 불량 회원의 부정 이용 방지, 가입
                의사 확인
              </li>
              <li>
                <strong>서비스 제공:</strong> AI 기반 면접 코칭, 이력서 분석, 맞춤형 채용 정보 매칭
                및 챗봇 서비스 제공
              </li>
              <li>
                <strong>서비스 개선:</strong> 신규 서비스 개발, AI 모델 응답 품질 개선(비식별화 처리
                후), 서비스 이용 통계 분석
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              3. 개인정보의 보유 및 이용 기간
            </h2>
            <p>
              원칙적으로, 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이
              파기합니다. 단, 다음의 정보는 아래의 이유로 명시한 기간 동안 보존합니다.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>보존 항목:</strong> 회원 가입 정보 및 서비스 이용 데이터
              </li>
              <li>
                <strong>보존 근거:</strong> 회원의 탈퇴 요청 시까지 (또는 서비스 종료 시까지)
              </li>
              <li>
                <strong>보존 기간:</strong> 회원 탈퇴 시 즉시 파기 (단, 관계 법령 위반에 따른
                수사·조사 등이 진행 중인 경우에는 해당 종료 시까지)
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              4. 개인정보의 제3자 제공 및 처리 위탁
            </h2>
            <p>
              회사는 원칙적으로 사용자의 개인정보를 외부에 제공하지 않습니다. 다만, 안정적인 서비스
              제공을 위해 아래와 같이 업무를 위탁하고 있습니다.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>클라우드 인프라:</strong> AWS (Amazon Web Services) - 데이터 저장 및 서버
                운영
              </li>
              <li>
                <strong>AI 모델 처리:</strong> OpenAI, Google Gemini - 챗봇 응답 생성 및 데이터 분석
                (전송된 데이터는 AI 모델 학습에 사용되지 않도록 설정됨)
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              5. 이용자의 권리와 행사 방법 (계정 삭제)
            </h2>
            <p>
              사용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 회원 탈퇴(계정
              삭제)를 요청할 수 있습니다.
            </p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>회원 탈퇴:</strong> 서비스 내 [설정 {'>'} 회원 탈퇴] 메뉴를 통해 즉시 탈퇴가
                가능합니다.
              </li>
              <li>
                <strong>삭제 요청:</strong> 탈퇴 기능 이용이 어려운 경우, 아래 개인정보 보호
                책임자에게 이메일로 요청하시면 확인 후 지체 없이 조치하겠습니다.
              </li>
              <li>
                <strong>파기 절차:</strong> 계정이 삭제되면 서버에 저장된 사용자의 모든
                개인정보(이메일, 채팅 로그, 업로드 파일)는 복구 불가능한 방법으로 파기됩니다.
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">6. 개인정보 보호 책임자</h2>
            <p>
              회사는 회원의 개인정보를 보호하고 관련 불만을 처리하기 위해 아래와 같이 개인정보 보호
              책임자를 지정하고 있습니다.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>이름:</strong> KTB_Devths
              </li>
              <li>
                <strong>이메일:</strong> ktbdevths@gmail.com
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">7. 시행일</h2>
            <p>본 방침은 2026년 2월 4일부터 시행됩니다.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
