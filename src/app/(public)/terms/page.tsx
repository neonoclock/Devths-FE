'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export default function TermsPage() {
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
            <h1 className="text-xl font-bold text-neutral-900">Devths 서비스 이용약관</h1>
            <p>
              본 약관은 KTB_Devths(이하 &quot;회사&quot;)가 제공하는 Devths 애플리케이션 서비스(이하
              &quot;서비스&quot;)의 이용과 관련하여 회사와 이용자 간 권리·의무 및 책임사항을
              규정합니다.
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">제1조(목적)</h2>
            <p>
              본 약관은 이용자가 서비스를 이용함에 있어 회사와 이용자의 권리, 의무, 책임, 서비스
              이용 조건 및 절차 등 기본사항을 정하는 것을 목적으로 합니다.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">제2조(용어의 정의)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                &quot;서비스&quot;란 회사가 제공하는 Devths 애플리케이션 및 관련 기능(AI 면접 코칭,
                이력서 분석, 맞춤형 채용 매칭, 챗봇 등)을 의미합니다.
              </li>
              <li>
                &quot;이용자&quot;란 본 약관에 동의하고 서비스를 이용하는 회원 및 비회원을 말합니다.
              </li>
              <li>
                &quot;회원&quot;이란 구글 로그인(OAuth) 등 회사가 정한 절차로 가입하여 계정을
                부여받은 자를 말합니다.
              </li>
              <li>
                &quot;콘텐츠&quot;란 이용자가 서비스 내에 입력·업로드한 텍스트, 파일(이력서,
                포트폴리오 등), 기타 정보를 의미합니다.
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">제3조(약관의 효력 및 변경)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>본 약관은 서비스 내 게시 또는 기타 방법으로 공지함으로써 효력이 발생합니다.</li>
              <li>
                회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일자
                및 개정 내용을 사전에 공지합니다.
              </li>
              <li>이용자가 변경 약관에 동의하지 않을 경우 이용을 중단하고 탈퇴할 수 있습니다.</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              제4조(회원가입 및 계정 관리)
            </h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                회원가입은 이용자가 구글 로그인(OAuth) 등을 통해 가입을 신청하고 회사가 이를
                승인함으로써 성립합니다.
              </li>
              <li>
                이용자는 정확한 정보를 제공해야 하며, 허위 정보 제공으로 인해 발생한 불이익은
                이용자에게 있습니다.
              </li>
              <li>
                회사는 계정의 보안 강화를 위해 필요 시 추가 인증 또는 제한 조치를 할 수 있습니다.
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              제5조(서비스의 제공 및 변경)
            </h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                회사는 AI 기반 면접 코칭, 이력서 분석, 채용 정보 매칭, 챗봇 기능 등을 제공합니다.
              </li>
              <li>
                회사는 서비스의 개선, 장애 대응, 정책 변경 등의 사유로 서비스 내용을 변경할 수
                있으며, 중요한 변경의 경우 사전에 공지합니다.
              </li>
              <li>
                회사는 시스템 점검, 장애, 통신망 문제 등으로 서비스 제공이 일시 중단될 수 있습니다.
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              제6조(AI 서비스 및 결과의 한계)
            </h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                서비스의 AI 기능은 이용자의 입력을 기반으로 자동 생성된 결과를 제공하며, 결과의
                정확성·완전성·적합성을 보장하지 않습니다.
              </li>
              <li>
                이용자는 AI가 제공하는 정보가 참고자료임을 이해하고, 중요한 의사결정(채용 지원,
                계약, 법률·의료 등)은 전문가 검토를 권장합니다.
              </li>
              <li>
                회사는 이용자가 AI 결과를 신뢰하거나 이용함으로써 발생한 손해에 대해 법령상 허용되는
                범위 내에서 책임을 제한할 수 있습니다.
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              제7조(이용자의 의무 및 금지행위)
            </h2>
            <p>이용자는 아래 행위를 해서는 안 됩니다.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>타인의 개인정보·계정 도용, 허위 정보 등록</li>
              <li>
                서비스의 정상 운영을 방해하는 행위(해킹, 리버스엔지니어링, 과도한 트래픽 유발 등)
              </li>
              <li>불법·유해 콘텐츠 업로드(음란물, 혐오, 폭력, 저작권 침해 등)</li>
              <li>AI 시스템을 악용하거나 정책/법령을 위반하는 목적의 이용</li>
            </ul>
            <p>
              회사는 위 금지행위가 확인될 경우 서비스 이용 제한, 게시물 삭제, 계정 정지/해지 등의
              조치를 할 수 있습니다.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              제8조(콘텐츠의 권리 및 이용)
            </h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>이용자가 업로드/입력한 콘텐츠의 권리는 원칙적으로 이용자에게 있습니다.</li>
              <li>
                회사는 서비스 제공 및 품질 개선(가능한 경우 비식별화/익명화)에 필요한 범위에서
                콘텐츠를 처리할 수 있습니다.
              </li>
              <li>
                이용자는 타인의 저작권 등 권리를 침해하지 않도록 해야 하며, 분쟁 발생 시 이용자가
                책임을 부담합니다.
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              제9조(회원 탈퇴 및 이용계약 해지)
            </h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                이용자는 언제든지 서비스 내 [설정 {'>'} 회원 탈퇴]를 통해 이용계약을 해지할 수
                있습니다.
              </li>
              <li>
                회사는 이용자가 본 약관을 위반하거나 서비스 운영을 방해하는 경우 사전 통지 후 이용을
                제한하거나 계약을 해지할 수 있습니다.
              </li>
              <li>탈퇴 시 개인정보 및 서비스 데이터는 개인정보처리방침에 따라 처리됩니다.</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">제10조(면책 및 책임 제한)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                회사는 천재지변, 불가항력, 이용자의 귀책사유로 발생한 손해에 대해 책임지지 않습니다.
              </li>
              <li>
                회사는 무료로 제공되는 서비스와 관련하여 법령상 허용되는 범위에서 책임을 제한할 수
                있습니다.
              </li>
              <li>
                회사는 이용자가 서비스 내에서 얻은 정보로 인해 발생한 손해에 대해 책임을 제한할 수
                있습니다.
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">
              제11조(분쟁 해결 및 준거법)
            </h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>회사와 이용자 간 분쟁은 상호 협의를 통해 해결하도록 노력합니다.</li>
              <li>
                협의가 어려운 경우 대한민국 법령을 준거법으로 하며, 관할 법원은 민사소송법 등 관련
                법령에 따릅니다.
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-neutral-900">부칙</h2>
            <p>본 약관은 2026년 2월 4일부터 시행됩니다.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
