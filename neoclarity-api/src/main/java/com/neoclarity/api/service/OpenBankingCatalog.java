package com.neoclarity.api.service;

import lombok.Builder;

import java.util.List;

/**
 * Mock Open Banking provider catalog. In production this list would come from
 * an aggregator (Plaid / Akoya / MX) institution directory. For MVP these are
 * the institutions a customer can "connect" via the simulated consent flow.
 *
 * The FDX-style account templates define what accounts each institution exposes
 * once consent is granted — mirroring how a real Open Banking provider returns
 * an account list after the OAuth consent handshake.
 */
public final class OpenBankingCatalog {

    private OpenBankingCatalog() {}

    @Builder
    public record Institution(
            String id,
            String name,
            String logo,         // emoji stand-in for a real logo asset
            String primaryColor,
            String description,
            List<AccountTemplate> accounts
    ) {}

    @Builder
    public record AccountTemplate(
            String accountType,   // CHECKING | SAVINGS | CREDIT | LOAN
            String displayName,
            double balance,
            String mask           // last 4 digits shown in consent UI
    ) {}

    public static final List<Institution> INSTITUTIONS = List.of(
            Institution.builder()
                    .id("chase")
                    .name("Chase")
                    .logo("\uD83C\uDFE6")
                    .primaryColor("#117ACA")
                    .description("Checking, savings, and credit cards")
                    .accounts(List.of(
                            AccountTemplate.builder().accountType("CHECKING").displayName("Chase Total Checking").balance(4250.00).mask("4821").build(),
                            AccountTemplate.builder().accountType("CREDIT").displayName("Chase Sapphire").balance(-1840.00).mask("9007").build()
                    ))
                    .build(),
            Institution.builder()
                    .id("ally")
                    .name("Ally Bank")
                    .logo("\uD83D\uDCB0")
                    .primaryColor("#6C1D5F")
                    .description("Online savings and money market")
                    .accounts(List.of(
                            AccountTemplate.builder().accountType("SAVINGS").displayName("Ally Online Savings").balance(3200.00).mask("2210").build()
                    ))
                    .build(),
            Institution.builder()
                    .id("bofa")
                    .name("Bank of America")
                    .logo("\uD83C\uDFE6")
                    .primaryColor("#E31837")
                    .description("Checking, savings, and credit")
                    .accounts(List.of(
                            AccountTemplate.builder().accountType("CHECKING").displayName("BofA Advantage Checking").balance(2680.00).mask("3344").build(),
                            AccountTemplate.builder().accountType("SAVINGS").displayName("BofA Savings").balance(5100.00).mask("8890").build()
                    ))
                    .build(),
            Institution.builder()
                    .id("wells")
                    .name("Wells Fargo")
                    .logo("\uD83C\uDFE6")
                    .primaryColor("#D71E28")
                    .description("Checking, savings, and home loans")
                    .accounts(List.of(
                            AccountTemplate.builder().accountType("CHECKING").displayName("Wells Everyday Checking").balance(1920.00).mask("5567").build(),
                            AccountTemplate.builder().accountType("LOAN").displayName("Wells Home Mortgage").balance(-284000.00).mask("0012").build()
                    ))
                    .build(),
            Institution.builder()
                    .id("capital_one")
                    .name("Capital One")
                    .logo("\uD83D\uDCB3")
                    .primaryColor("#004977")
                    .description("360 checking, savings, and credit cards")
                    .accounts(List.of(
                            AccountTemplate.builder().accountType("SAVINGS").displayName("Capital One 360 Savings").balance(8400.00).mask("7781").build(),
                            AccountTemplate.builder().accountType("CREDIT").displayName("Capital One Venture").balance(-920.00).mask("3290").build()
                    ))
                    .build(),
            Institution.builder()
                    .id("amex")
                    .name("American Express")
                    .logo("\uD83D\uDCB3")
                    .primaryColor("#006FCF")
                    .description("Credit cards and high-yield savings")
                    .accounts(List.of(
                            AccountTemplate.builder().accountType("CREDIT").displayName("Amex Gold Card").balance(-2150.00).mask("1004").build(),
                            AccountTemplate.builder().accountType("SAVINGS").displayName("Amex High Yield Savings").balance(12500.00).mask("6643").build()
                    ))
                    .build()
    );

    public static Institution byId(String id) {
        return INSTITUTIONS.stream()
                .filter(i -> i.id().equals(id))
                .findFirst()
                .orElse(null);
    }
}
